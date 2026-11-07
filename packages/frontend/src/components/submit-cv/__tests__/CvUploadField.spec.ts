import { isAcceptedCvFile } from '../CvUploadField';

describe('isAcceptedCvFile', () => {
  it.each(['cv.pdf', 'CV.PDF', 'my.resume.pdf', 'CV Nguyễn Văn A.pdf'])('accepts %s', (name) => {
    expect(isAcceptedCvFile(new File(['x'], name))).toBe(true);
  });

  it.each(['cv.doc', 'cv.docx', 'cv.txt', 'cv.pdf.exe', 'cv', 'pdf'])('rejects %s (PDF only)', (name) => {
    expect(isAcceptedCvFile(new File(['x'], name))).toBe(false);
  });

  it('accepts a .pdf file without MIME type', () => {
    expect(isAcceptedCvFile(new File(['x'], 'cv.pdf', { type: '' }))).toBe(true);
  });
});
