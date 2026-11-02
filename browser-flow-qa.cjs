const {createRequire}=require('node:module');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const {chromium}=createRequire(process.env.TEMP+'/desisan-browser-qa/package.json')('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const p=await browser.newPage({viewport:{width:360,height:900}});
 const errors=[]; p.on('pageerror',e=>errors.push(e.message));
 const go=async name=>p.goto(pathToFileURL(process.cwd()+'/dist/'+name+'.html').href);
 await go('cart-loading'); await p.waitForSelector('[data-cart-item]');
 await go('cart-load-failed'); await p.locator('[data-cart-retry]').click(); await p.waitForSelector('[data-cart-item]');
 await p.evaluate(()=>window.DesisanIntegrations={validateCart:async()=>({valid:false,changed:true,items:[{id:document.querySelector('[data-cart-item] a').getAttribute('href'),price:12345}]})});
 await p.locator('[data-cart-checkout]').click(); await p.waitForSelector('[data-cart-checkout-error]:visible');
 if(!p.url().includes('cart-load-failed'))throw Error('Cart navigated after price change');
 await go('checkout-load-failed'); await p.locator('[data-checkout-retry]').click(); await p.waitForSelector('#checkout-form');
 await go('checkout-long'); if(await p.locator('.checkout-item').count()!==15)throw Error('Checkout 15 items');
 await go('checkout-filled');
 await p.evaluate(()=>{window.qaCreated=0;window.DesisanIntegrations={validateCheckout:async values=>{if(!values.get('name'))throw Error('Missing draft');return {changed:true,total:22980,discount:2500,items:[{id:1,price:13490}]};},createOrder:async()=>{window.qaCreated++;return {status:'not-created'};}}});
 await p.locator('[data-checkout-submit]').click();await p.waitForSelector('[data-checkout-notice]:visible');
 if(await p.evaluate(()=>window.qaCreated)!==0)throw Error('Created after price change');
 if(!(await p.locator('[data-checkout-total]').textContent()).includes('22'))throw Error('No new total');
 await go('index2'); await p.locator('[data-open-dialog="product-review"]').click();
 await p.locator('.review-form [name="consent"]').check(); await p.locator('.review-form__submit').click();
 if(await p.locator('.review-form__error:visible').count()!==3)throw Error('Review validation');
 await p.locator('#review-name').fill('  Анна  ');await p.locator('#review-text').fill('Очень красивая и удобная сумка, спасибо магазину.');await p.locator('[name="rating"][value="5"]').check();
 await p.evaluate(()=>window.DesisanIntegrations={sendProductReview:async()=>{throw Error('offline')}});
 await p.locator('.review-form__submit').click();await p.waitForSelector('.review-form__status:visible');
 if(!(await p.locator('#review-text').inputValue()).includes('сумка'))throw Error('Review draft lost');
 await p.evaluate(()=>window.DesisanIntegrations={sendProductReview:async values=>({status:values.get('name')==='Анна'?'sent':'error'})});
 await p.locator('.review-form__submit').click();await p.waitForSelector('.review-form__success');
 for(const file of fs.readdirSync('dist').filter(n=>/^email-\d/.test(n))){
  if(fs.statSync('dist/'+file).size>=102*1024)throw Error('Email over size '+file);
  for(const width of [600,360,320]){await p.setViewportSize({width,height:900});await go(file.slice(0,-5));if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Email overflow '+file);}
 }
 if(errors.length)throw Error(errors.join('\n'));
 await go('home-menu');
 await p.setViewportSize({width:360,height:900});
 // Открываем после смены ширины, если предыдущая проверка была на desktop.
 if(!await p.locator('#mobile-menu').evaluate(e=>e.open))await p.locator('[data-open-dialog="mobile-menu"]').click();
 await p.locator('.mobile-menu__categories a').first().evaluate(a=>a.href='home-one.html');
 await p.locator('.mobile-menu__categories a').first().click();
 await p.waitForURL('**/home-one.html');
 for(const name of ['email-01-order','checkout-price-changed','catalog-women','catalog-section','product-no-photo','index2','index8','index10']) {
  for(const width of [360,1920]) {
   await p.setViewportSize({width,height:900});await go(name);
   await p.screenshot({path:process.env.TEMP+`/desisan-${name}-${width}.png`,fullPage:true});
   if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow '+name+' '+width);
  }
 }
 await go('product-15-photos');
 await p.locator('.product-gallery [data-gallery-prev]').click();
 await p.waitForFunction(()=>document.querySelector('[data-gallery-counter]').textContent==='15 / 15');
 await p.locator('.product-gallery [data-gallery-next]').click();
 await p.waitForFunction(()=>document.querySelector('[data-gallery-counter]').textContent==='1 / 15');
 await p.locator('[data-open-dialog="product-viewer"]').first().click();
 await p.keyboard.press('ArrowLeft');
 await p.keyboard.press('Escape');
 if(await p.locator('#product-viewer').evaluate(e=>e.open))throw Error('Viewer Escape');
 for(const name of ['catalog-women','catalog-section','catalog-empty','catalog-applied','catalog-price','catalog-sort','catalog-filters','product-review-form','product-review-validation','product-review-error','product-review-sending','product-review-sent','product-viewer','home-one','home-city-notice']) {
  await p.setViewportSize({width:360,height:900});await go(name);
  await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))});
  if(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Preview overflow '+name);
 }
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Cart loading/preflight, checkout draft/price-change/15 items, review validation/retry/moderation, 8 emails at 3 widths: passed');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
