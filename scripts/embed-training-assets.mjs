import { readdir, readFile, writeFile } from 'node:fs/promises';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const assets={};
for(const name of (await readdir('training-ui')).sort()) {
 const suffix=name.slice(name.lastIndexOf('.'));if(types[suffix])assets['/static/'+name]={type:types[suffix],body:await readFile('training-ui/'+name,'utf8')};
}
await writeFile('lib/training-assets.ts','// Generated from training-ui/ by scripts/embed-training-assets.mjs.\nexport const assets: Record<string,{type:string,body:string}> = '+JSON.stringify(assets)+';\n');
