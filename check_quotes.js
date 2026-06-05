const fs=require('fs');
const c=fs.readFileSync('src/lib/bridge-api.ts','utf-8');

// Count special chars
let backtick=0, dquote=0, squote=0, openBrace=0, closeBrace=0;
let lastType = '';
for (let i=0; i<c.length; i++){
   const ch=c[i];
   if (ch==='`') backtick++;
   else if (ch==='"') dquote++;
   else if (ch==="'") squote++;
   else if (ch==='{') openBrace++;
   else if (ch==='}') closeBrace++;
}
console.log('Backticks:',backtick,'even:',backtick%2===0);
console.log('Double quotes:',dquote,'even:',dquote%2===0);
console.log('Single quotes:',squote,'even:',squote%2===0);
console.log('Braces:',openBrace,'/',closeBrace,'balanced:',openBrace===closeBrace);

// Find lines with unbalanced quotes
const lines=c.split('\n');
lines.forEach((line,i)=>{
   const bq=(line.match(/`/g)||[]).length;
   if(bq%2!==0) console.log('ODD backtick line '+(i+1)+':',line.substring(0,80));
});
