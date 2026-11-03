export async function readingContrast(page,selector){
 const texts=await page.locator(selector).evaluate(root=>{
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),texts=[];let n;
  while(n=walker.nextNode())if(n.textContent.trim()&&!n.parentElement.closest("button")){
   const css=getComputedStyle(n.parentElement);if(css.visibility==="hidden"||css.display==="none")continue;
   const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height)texts.push({text:n.textContent,color:css.color,rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom}});
  }return texts;
 });
 const hide=await page.addStyleTag({content:`${selector},${selector} *{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0 transparent!important}`});
 const background=await page.screenshot();await hide.evaluate(n=>n.remove());
 const samples=await page.evaluate(async({background,texts})=>{
  const image=new Image();image.src=background;await image.decode();const canvas=document.createElement("canvas");canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
  return texts.map(t=>{const rgba=t.color.match(/[\d.]+/g).map(Number),alpha=rgba[3]??1;let minimum=Infinity;
   for(let y=Math.max(0,Math.floor(t.rect.top));y<Math.min(canvas.height,Math.ceil(t.rect.bottom));y++)for(let x=Math.max(0,Math.floor(t.rect.left));x<Math.min(canvas.width,Math.ceil(t.rect.right));x++){
    const i=(y*canvas.width+x)*4,rgb=[pixels[i],pixels[i+1],pixels[i+2]],bg=luminance(rgb),fg=luminance(rgb.map((v,i)=>rgba[i]*alpha+v*(1-alpha)));minimum=Math.min(minimum,(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05));
   }return {text:t.text,minimum};
  });
 },{background:`data:image/png;base64,${background.toString("base64")}`,texts});
 return {minimum:Math.min(...samples.map(s=>s.minimum)),samples};
}
