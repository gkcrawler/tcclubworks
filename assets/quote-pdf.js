/* Direct PDF creation using the original quote layout; quote data stays in the browser. */
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
    if(!assets) assets = Promise.all([
      bytes('/assets/fonts/LiberationSans-Regular.ttf'),
      bytes('/assets/fonts/LiberationSans-Bold.ttf'),
      bytes('/assets/ccw-quote-helmet.png')
    ]).catch(function(err){ assets=null; throw err; });
    var resources = await assets;
    var pdf = await PDFLib.PDFDocument.create();
    pdf.registerFontkit(fontkit);
    var regular = await pdf.embedFont(resources[0], {subset:true});
    var bold = await pdf.embedFont(resources[1], {subset:true});
    var logo = await pdf.embedPng(resources[2]);
    var ink=PDFLib.rgb(21/255,21/255,31/255), muted=PDFLib.rgb(.333,.333,.333);
    var border=PDFLib.rgb(216/255,216/255,229/255), ruleColor=PDFLib.rgb(.867,.867,.867);
    var margin=49, right=563, width=514, bottom=748, top=50, lineHeight=15.225;
    var page, y;
    var currency = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
    function clean(value){ return String(value == null ? '' : value).replace(/\r\n?/g,'\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/\t/g,'    '); }
    function newPage(){page=pdf.addPage([612,792]);y=top;}
    function ensure(height){if(y+height>bottom)newPage();}
    function text(value,x,at,size,font,color){
      page.drawText(clean(value),{x:x,y:792-at-size,size:size||10.5,font:font||regular,color:color||ink});
    }
    function rightText(value,end,at,size,font,maxWidth,color){
      font=font||regular;value=clean(value);
      if(maxWidth)size=Math.min(size,maxWidth/font.widthOfTextAtSize(value,1));
      text(value,end-font.widthOfTextAtSize(value,size),at,size,font,color);
    }
    function heading(value,x,at,size,alignRight){
      size=size||9.75;
      var tracking=size*.12, chars=Array.from(value.toUpperCase());
      var length=bold.widthOfTextAtSize(value.toUpperCase(),size)+Math.max(0,chars.length-1)*tracking;
      if(alignRight)x-=length;
      chars.forEach(function(ch){text(ch,x,at,size,bold,muted);x+=bold.widthOfTextAtSize(ch,size)+tracking;});
    }
    function rule(at,start,end,thickness,color){
      page.drawLine({start:{x:start,y:792-at},end:{x:end,y:792-at},thickness:thickness||.75,color:color||ruleColor});
    }
    function wrap(value,max,size,font){
      font=font||regular;size=size||10.5;
      var lines=[];
      clean(value).split('\n').forEach(function(paragraph){
        var current='';
        for(var ch of paragraph){
          if(current && font.widthOfTextAtSize(current+ch,size)>max){
            var space=current.lastIndexOf(' ');
            if(space>0){lines.push(current.slice(0,space));current=current.slice(space+1)+ch;}
            else{lines.push(current);current=ch;}
          }else current+=ch;
        }
        lines.push(current);
      });
      return lines;
    }
    function roundedBox(x,at,w,h){
      var r=7.5;
      page.drawSvgPath('M '+r+' 0 H '+(w-r)+' Q '+w+' 0 '+w+' '+r+' V '+(h-r)+' Q '+w+' '+h+' '+(w-r)+' '+h+' H '+r+' Q 0 '+h+' 0 '+(h-r)+' V '+r+' Q 0 0 '+r+' 0 Z',
        {x:x,y:792-at,borderColor:border,borderWidth:.75});
    }
    function linesFor(parts,w){
      var result=[];
      parts.filter(function(p){return p.value;}).forEach(function(p){
        var lines=wrap(p.value,w,10.5,p.bold?bold:regular);
        lines.forEach(function(s,i){result.push({value:s,bold:p.bold,link:p.link,height:lineHeight+(i===lines.length-1?4.5:0)});});
      });
      return result;
    }
    function linkAnnotation(value,x,at,w){
      if(!/^https?:\/\//i.test(value||''))return;
      var ref=pdf.context.register(pdf.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,792-at-lineHeight,x+w,792-at+2],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFLib.PDFString.of(value)}}));
      page.node.addAnnot(ref);
    }
    function card(label,x,at,w,lines,h){
      roundedBox(x,at,w,h);
      heading(label,x+12.75,at+13.5);
      var cursor=at+37.5;
      lines.forEach(function(row){
        text(row.value,x+12.75,cursor,10.5,row.bold?bold:regular);
        if(row.link)linkAnnotation(row.link,x+12.75,cursor,Math.min(w-25.5,regular.widthOfTextAtSize(row.value,10.5)));
        cursor+=row.height;
      });
    }
    function heightOf(lines){return 46.5+lines.reduce(function(sum,row){return sum+row.height;},0);}
    function takeLines(lines,available){
      var result=[],height=46.5;
      while(lines.length && height+lines[0].height<=available){var row=lines.shift();result.push(row);height+=row.height;}
      return result;
    }
    // Move ordinary boxes as a unit. Exceptionally long sections continue in bordered boxes.
    function section(label,parts){
      var lines=linesFor(parts,width-25.5);
      if(!lines.length)return;
      var total=heightOf(lines),continued=false;
      if(total<=bottom-top)ensure(total);
      while(lines.length){
        ensure(46.5+lines[0].height);
        var chunk=takeLines(lines,bottom-y),h=heightOf(chunk);
        card(label+(continued?' (continued)':''),margin,y,width,chunk,h);
        y+=h+14;
        if(lines.length){newPage();continued=true;}
      }
    }
    newPage();
    // Original left logo/contact block and right-aligned quote metadata.
    // Convert the printed width from millimeters to PDF points.
    var logoWidth=61.5*72/25.4;
    var logoHeight=logoWidth*logo.height/logo.width;
    page.drawImage(logo,{x:margin,y:792-top-logoHeight,width:logoWidth,height:logoHeight});
    heading('Estimate / Quote',right,top,8.25,true);
    var number=clean(q.quoteNumber || 'Chronic Clubworks Quote');
    var numberSize=Math.min(25.5,320/bold.widthOfTextAtSize(number,1));
    var numberLines=wrap(number,320,Math.max(16,numberSize),bold);
    var metaY=top+18;
    numberLines.forEach(function(s){rightText(s,right,metaY,Math.max(16,numberSize),bold);metaY+=Math.max(16,numberSize)*1.15;});
    metaY+=8;
    ['Status: '+(q.status||'Draft'),'Date: '+(q.quoteDate||''),'Valid until: '+(q.validUntil||'')].forEach(function(s){
      wrap(s,320,10.5).forEach(function(line){rightText(line,right,metaY,10.5);metaY+=lineHeight;});
    });
    var contactTop=top+logoHeight+8;
    ['Denver, CO','(720) 854-4132','info@tcclubworks.io','tcclubworks.io'].forEach(function(s,i){text(s,margin,contactTop+i*lineHeight,10.5);});
    y=Math.max(contactTop+4*lineHeight+17.5,metaY+18);rule(y,margin,right,2.25,ink);y+=34.5;
    var cardWidth=(width-21)/2;
    var customer=linesFor([{value:q.customerName,bold:true},{value:q.customerEmail},{value:q.customerPhone}],cardWidth-25.5);
    var request=linesFor([{value:q.customerService,bold:true},{value:q.customerMessage}],cardWidth-25.5);
    var cardHeight=Math.max(heightOf(customer),heightOf(request));
    if(cardHeight<=bottom-top)ensure(cardHeight);
    var continued=false;
    do{
      ensure(66.225);
      var left=takeLines(customer,bottom-y),r=takeLines(request,bottom-y);
      var h=Math.max(heightOf(left),heightOf(r));
      card('Prepared for'+(continued?' (continued)':''),margin,y,cardWidth,left,h);
      card('Request'+(continued?' (continued)':''),margin+cardWidth+21,y,cardWidth,r,h);
      y+=h+25.5;
      if(customer.length||request.length){newPage();continued=true;}
    }while(customer.length||request.length);
    function tableHeader(){
      text('Description',margin+7.5,y,10.5,bold,muted);
      rightText('Qty',352,y,10.5,bold,null,muted);rightText('Unit',444,y,10.5,bold,null,muted);rightText('Total',right-7.5,y,10.5,bold,null,muted);
      y+=30;
    }
    ensure(62);tableHeader();
    (q.items||[]).forEach(function(item){
      var lines=wrap(item.desc,275,10.5),first=true;
      var height=lines.length*lineHeight+15;
      if(height<=bottom-top-30 && y+height>bottom){newPage();tableHeader();}
      while(lines.length){
        if(y+lineHeight+15>bottom){newPage();tableHeader();}
        var count=Math.min(lines.length,Math.floor((bottom-y-15)/lineHeight));
        var chunk=lines.splice(0,count);
        if(first){
          rightText(String(item.qty),352,y,10.5,regular,45);
          rightText(currency.format(item.unit),444,y,10.5,regular,76);
          rightText(currency.format(item.total),right-7.5,y,10.5,regular,96);
          first=false;
        }
        chunk.forEach(function(s){text(s,margin+7.5,y,10.5);y+=lineHeight;});
        y+=7.5;rule(y,margin,right);y+=7.5;
      }
    });
    y+=11;
    ensure(150);
    [['Subtotal',q.subtotal],['Discount',q.discount],['Tax',q.tax],['Total',q.total],['Balance after deposit',q.balance]].forEach(function(row){
      var grand=row[0]==='Total',size=grand?13.5:10.5;
      text(row[0],right-240,y,size,grand?bold:regular);
      rightText(currency.format(row[1]||0),right,y,size,bold,110);
      y+=grand?23:21;rule(y,right-240,right,grand?1.5:.75,grand?ink:ruleColor);y+=6;
    });
    y+=22.5;
    section('Notes',[{value:q.notes}]);
    section('Terms',[{value:q.terms}]);
    section('Approval and payment',[
      {value:approvalLink?'Approve this quote: '+approvalLink:'',link:approvalLink},
      {value:q.paymentLink?'Deposit/payment link: '+q.paymentLink:'',link:q.paymentLink}
    ]);
    var footer=wrap('Prepared by '+(q.preparedBy||'Chronic Clubworks')+'. Please reply to approve this quote before work begins.',width,9);
    ensure(14+footer.length*13);y+=14;
    footer.forEach(function(s){text(s,margin,y,9,regular,muted);y+=13;});
    var pages=pdf.getPages();
    pages.forEach(function(p,i){
      var label=(i+1)+' / '+pages.length;
      p.drawText(label,{x:right-regular.widthOfTextAtSize(label,8),y:22,size:8,font:regular,color:muted});
    });
    pdf.setTitle(filename(q).replace(/\.pdf$/,''));pdf.setAuthor('Chronic Clubworks');
    return pdf.save();
  }
  window.QuotePDF={create:create,filename:filename};
})();
