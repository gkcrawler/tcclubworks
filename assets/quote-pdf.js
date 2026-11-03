/* Direct PDF creation; quote data stays in the browser. */
(function(){
  var assets;
  function filename(q){
    return [q.customerName, q.quoteNumber || 'Chronic Clubworks Quote'].map(function(s){
      return String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0,100);
    }).filter(Boolean).join(' - ') + '.pdf';
  }
  async function bytes(url){
    var response = await fetch(url);
    if(!response.ok) throw new Error('Could not load PDF assets.');
    return response.arrayBuffer();
  }
  async function create(q, approvalLink){
    if(!assets) assets = Promise.all([bytes('/assets/fonts/NotoSans-Regular.ttf'), bytes('/assets/quote-logo.png')]).catch(function(err){ assets=null; throw err; });
    var resources = await assets;
    var pdf = await PDFLib.PDFDocument.create();
    pdf.registerFontkit(fontkit);
    var font = await pdf.embedFont(resources[0], {subset:true});
    var logo = await pdf.embedPng(resources[1]);
    var ink=PDFLib.rgb(.08,.08,.13), muted=PDFLib.rgb(.35,.35,.4), line=PDFLib.rgb(.83,.83,.87);
    var page, y, margin=40, width=532;
    var currency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
    function text(value,x,at,size,color){page.drawText(String(value),{x:x,y:at,size:size||10,font:font,color:color||ink});}
    function newPage(){page=pdf.addPage([612,792]);y=748;}
    function ensure(height){if(y-height<44)newPage();}
    function wrap(value, max, size){
      var result=[];
      String(value || '').replace(/\r/g,'').split('\n').forEach(function(paragraph){
        var current='';
        for(var ch of paragraph){
          if(current && font.widthOfTextAtSize(current+ch,size)>max){
            var space=current.lastIndexOf(' ');
            if(space>0){result.push(current.slice(0,space));current=current.slice(space+1)+ch;}
            else {result.push(current);current=ch;}
          }else current+=ch;
        }
        result.push(current);
      });
      return result;
    }
    function paragraph(value,size,color){
      wrap(value,width,size||10).forEach(function(s){ensure(16);text(s,margin,y,size,color);y-=15;});
    }
    function section(label,value){
      if(!value)return;
      ensure(45);y-=12;text(label.toUpperCase(),margin,y,10,muted);y-=19;paragraph(value);
    }
    function rule(){page.drawLine({start:{x:margin,y:y},end:{x:572,y:y},thickness:.7,color:line});y-=17;}
    newPage();
    page.drawImage(logo,{x:margin,y:y-62,width:62*logo.width/logo.height,height:62});
    text('ESTIMATE / QUOTE',365,y,12);y-=84;
    paragraph(q.quoteNumber || 'Chronic Clubworks Quote',18);y-=8;
    paragraph('Denver, CO  |  (720) 854-4132  |  info@tcclubworks.io',9,muted);
    paragraph('Date: '+q.quoteDate+'    Valid until: '+q.validUntil+'    Status: '+q.status,9,muted);y-=8;rule();
    section('Prepared for',[q.customerName,q.customerEmail,q.customerPhone].filter(Boolean).join('\n'));
    section('Request',[q.customerService,q.customerMessage].filter(Boolean).join('\n'));y-=18;
    function tableHeader(){ensure(35);text('Description',40,y,10,muted);text('Qty',365,y,10,muted);text('Unit',420,y,10,muted);text('Total',510,y,10,muted);y-=10;rule();}
    function right(value,x){text(value,x-font.widthOfTextAtSize(value,10),y,10);}
    tableHeader();
    q.items.forEach(function(item){
      var lines=wrap(item.desc,300,10);
      if(y-Math.min(lines.length*15+16,80)<44){newPage();tableHeader();}
      lines.forEach(function(s,i){
        if(y-16<44){newPage();tableHeader();}
        text(s,40,y,10);
        if(i===0){right(String(item.qty),390);right(currency.format(item.unit),480);right(currency.format(item.total),572);}
        y-=15;
      });y-=4;rule();
    });
    ensure(125);
    [['Subtotal',q.subtotal],['Discount',q.discount],['Tax',q.tax],['Total',q.total],['Deposit due',q.deposit],['Balance after deposit',q.balance]].forEach(function(row){text(row[0],330,y,10);right(currency.format(row[1]||0),572);y-=18;});
    section('Notes',q.notes);section('Terms',q.terms);
    section('Approval and payment',[approvalLink ? 'Approve this quote: '+approvalLink : '',q.paymentLink ? 'Deposit/payment link: '+q.paymentLink : ''].filter(Boolean).join('\n'));
    section('Prepared by',q.preparedBy || 'Chronic Clubworks');
    var pages=pdf.getPages();pages.forEach(function(p,i){p.drawText('Chronic Clubworks  |  '+(i+1)+' / '+pages.length,{x:40,y:22,size:8,font:font,color:muted});});
    pdf.setTitle(filename(q).replace(/\.pdf$/,''));pdf.setAuthor('Chronic Clubworks');
    return pdf.save();
  }
  window.QuotePDF={create:create,filename:filename};
})();
