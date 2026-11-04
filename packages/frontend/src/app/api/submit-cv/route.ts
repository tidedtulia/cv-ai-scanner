import { NextResponse } from 'next/server';
import { CV_MAX_FILE_SIZE_BYTES, CV_MAX_FILE_SIZE_MB } from '@org/shared';

export async function POST(req: Request) {
  const formData = await req.formData();

  const name = formData.get('name');
  const email = formData.get('email');
  const position = formData.get('position');
  const file = formData.get('cv');

  if (!name || !email || !position || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, message: 'Missing fields' },
      { status: 400 },
    );
  }

  if (file.size > CV_MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, message: `File size must not exceed ${CV_MAX_FILE_SIZE_MB}MB` },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, message: 'Submit CV successfully' });
}
