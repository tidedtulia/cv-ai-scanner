/**
 * @jest-environment node
 */
import { CV_MAX_FILE_SIZE_BYTES } from '@org/shared';
import { POST } from './route';

function makeRequest(fields: Record<string, string | File>): Request {
  const body = new FormData();
  Object.entries(fields).forEach(([key, value]) => body.append(key, value));
  return new Request('http://localhost/api/submit-cv', { method: 'POST', body });
}

const validFields = () => ({
  name: 'Jane Doe',
  email: 'jane@example.com',
  position: 'frontend-dev',
  cv: new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' }),
});

describe('POST /api/submit-cv', () => {
  it('returns success when all fields are present', async () => {
    const res = await POST(makeRequest(validFields()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, message: 'Submit CV successfully' });
  });

  it.each(['name', 'email', 'position', 'cv'])('returns 400 when %s is missing', async (missing) => {
    const fields: Record<string, string | File> = validFields();
    delete fields[missing];

    const res = await POST(makeRequest(fields));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, message: 'Missing fields' });
  });

  it('returns 400 when cv is a string instead of a file', async () => {
    const res = await POST(makeRequest({ ...validFields(), cv: 'not-a-file' }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, message: 'Missing fields' });
  });

  it('returns 400 when the file exceeds 10MB', async () => {
    const big = new File([new Uint8Array(CV_MAX_FILE_SIZE_BYTES + 1)], 'big.pdf', { type: 'application/pdf' });

    const res = await POST(makeRequest({ ...validFields(), cv: big }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, message: 'File size must not exceed 10MB' });
  });

  it('accepts a file of exactly 10MB', async () => {
    const edge = new File([new Uint8Array(CV_MAX_FILE_SIZE_BYTES)], 'edge.pdf', { type: 'application/pdf' });

    const res = await POST(makeRequest({ ...validFields(), cv: edge }));

    expect(res.status).toBe(200);
  });
});
