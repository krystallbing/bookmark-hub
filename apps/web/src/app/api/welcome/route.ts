import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function POST() {
  const db = getDB();
  const showWelcome = db.getSetting('welcomeShown') !== 'true';
  if (showWelcome) db.setSetting('welcomeShown', 'true');
  return NextResponse.json({ showWelcome });
}
