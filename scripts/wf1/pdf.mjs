// Minimal PDF writers for the WF-1 test CVs (no dependency): a text PDF and an image-only ("scanned") PDF.

const escape = (text) => text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function assemble(objects) {
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Text PDF (A4, Helvetica 11pt, ASCII only), one string per line, automatic page breaks. */
export function textPdf(lines) {
  const perPage = 52;
  const pages = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const kids = [];
  for (const page of pages) {
    const stream = `BT /F1 11 Tf 14 TL 50 790 Td\n${page.map((line) => `(${escape(line)}) Tj T*`).join('\n')}\nET`;
    const content = objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
    const pageObj = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`);
    kids.push(`${pageObj} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;
  return assemble(objects);
}

/** Image-only PDF (A4): one grayscale JPEG per page and no text layer, like a scanned CV. */
export function imagePdf(jpegPages) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', null];
  const kids = [];
  for (const { data, width, height } of jpegPages) {
    const image = objects.length + 1;
    objects.push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n${data.toString('latin1')}\nendstream`);
    const stream = 'q 595 0 0 842 0 0 cm /Im0 Do Q';
    const content = objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const page = objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`);
    kids.push(`${page} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${kids.length} >>`;
  return assemble(objects);
}
