import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import mammoth from 'mammoth';

test('updated Word importer preserves accents, paragraphs and table content', async () => {
  // Small in-memory document; never reads employee files or writes user data.
  const zip = new JSZip();
  zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Proyección de obra</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cantidad 20 m³</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>');
  const buffer=await zip.generateAsync({type:'nodebuffer'});
  const text=await mammoth.extractRawText({buffer});
  assert.match(text.value,/Proyección de obra/);
  assert.match(text.value,/Cantidad 20 m³/);
  const html=await mammoth.convertToHtml({buffer});
  assert.match(html.value,/<table>/);
  assert.match(html.value,/Proyección de obra/);
});
