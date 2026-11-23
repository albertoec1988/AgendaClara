import { mkdir, copyFile } from 'node:fs/promises';
const output = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });
for (const name of ['index.html','app.js','model.js','styles.css','brand.svg']) {
  await copyFile(new URL('../web/'+name,import.meta.url),new URL(name,output));
}
console.log('Aplicación estática lista en dist/.');
