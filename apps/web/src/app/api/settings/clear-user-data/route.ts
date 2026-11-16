import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

const CONFIRMATION = 'CLEAR_BOOKMARK_DATA';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.confirmation !== CONFIRMATION) {
    return NextResponse.json({ error: '缺少清空确认' }, { status: 400 });
  }

  const cleared = getDB().clearUserData();
  return NextResponse.json({ ok: true, cleared });
}
