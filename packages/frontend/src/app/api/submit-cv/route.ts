import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const formData = await req.formData();

  const name = formData.get('name');
  const email = formData.get('email');
  const position = formData.get('position');
  const file = formData.get('cv');

  if (!name || !email || !position || !file) {
    return NextResponse.json(
      { success: false, message: 'Missing fields' },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, message: 'Submit CV successfully' });
}
