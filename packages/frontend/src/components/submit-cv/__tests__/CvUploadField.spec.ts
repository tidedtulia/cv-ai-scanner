import { isAcceptedCvFile } from '../CvUploadField';

describe('isAcceptedCvFile', () => {
  it.each(['cv.pdf', 'cv.doc', 'cv.docx', 'CV.PDF', 'my.resume.docx'])('accepts %s', (name) => {
    expect(isAcceptedCvFile(new File(['x'], name))).toBe(true);
  });

  it.each(['cv.txt', 'cv.pdf.exe', 'cv', 'pdf', 'cv.docx.zip'])('rejects %s', (name) => {
    expect(isAcceptedCvFile(new File(['x'], name))).toBe(false);
  });

  it('accepts a .docx file without MIME type', () => {
    expect(isAcceptedCvFile(new File(['x'], 'cv.docx', { type: '' }))).toBe(true);
  });
});
