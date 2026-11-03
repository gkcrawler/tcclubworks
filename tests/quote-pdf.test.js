const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const PDFLib=require('../assets/vendor/pdf-lib.min.js');
const fontkit=require('../assets/vendor/fontkit.min.js');
const root=path.resolve(__dirname,'..');
const window={};
const fetchAsset=async url=>({ok:true,arrayBuffer:async()=>Uint8Array.from(fs.readFileSync(path.join(root,url))).buffer});
new Function('window','PDFLib','fontkit','fetch',fs.readFileSync(path.join(root,'assets/quote-pdf.js'),'utf8'))(window,PDFLib,fontkit,fetchAsset);
const QuotePDF=window.QuotePDF;
const quote={customerName:'José / Smith',quoteNumber:'CCW-TEST',quoteDate:'2026-11-03',validUntil:'2026-11-17',status:'Draft',customerService:'Loft and lie',customerMessage:'Bend 2° flat.',items:[{desc:'Adjustment',qty:10,unit:12,total:120}],subtotal:120,discount:0,tax:0,total:120,balance:100,notes:'First line\nSecond line',terms:'Approve before work begins.',paymentLink:'https://example.com/pay'};

test('PDF filename includes customer and quote, preserves accents, and removes path separators',()=>{
 assert.equal(QuotePDF.filename(quote),'José - Smith - CCW-TEST.pdf');
 assert.equal(QuotePDF.filename({...quote,customerName:'  '}),'CCW-TEST.pdf');
 assert.equal(QuotePDF.filename({}),'Chronic Clubworks Quote.pdf');
});

test('download is a readable PDF with the customer title and functional approval/payment links',async()=>{
 const pdf=await PDFLib.PDFDocument.load(await QuotePDF.create(quote,'https://example.com/approve'));
 assert.equal(pdf.getTitle(),'José - Smith - CCW-TEST');
 const links=pdf.getPages().flatMap(page=>(page.node.Annots()?.asArray()||[]).map(ref=>{
  const annotation=pdf.context.lookup(ref);
  return annotation.lookup(PDFLib.PDFName.of('A')).lookup(PDFLib.PDFName.of('URI')).decodeText();
 }));
 assert(links.includes('https://example.com/approve'));
 assert(links.includes('https://example.com/pay'));
});

test('long request, line item and notes paginate without text below the page',async()=>{
 const pdf=await PDFLib.PDFDocument.load(await QuotePDF.create({...quote,
  customerMessage:'Request details.\n'.repeat(90),
  items:[{desc:'Long line item description. '.repeat(300),qty:10,unit:12,total:120}],
  notes:'Note details.\n'.repeat(90)
 },''));
 assert(pdf.getPageCount()>3);
 for(const page of pdf.getPages()){
  assert.deepEqual(page.getSize(),{width:612,height:792});
  const content=page.node.Contents().asArray().map(ref=>Buffer.from(PDFLib.decodePDFRawStream(pdf.context.lookup(ref)).decode()).toString()).join('\n');
  const positions=[...content.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)];
  assert(positions.length>1,'Unexpected blank page');
  for(const [,x,y] of positions){
   assert(+x>=49 && +x<=563,`Text outside horizontal margins: ${x}`);
   assert(+y>=22 && +y<=742,`Text outside vertical margins: ${y}`);
  }
 }
});
