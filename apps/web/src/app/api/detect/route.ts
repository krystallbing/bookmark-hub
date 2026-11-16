import { NextResponse } from 'next/server';
import { detectChromeProfiles } from '@bookmark-hub/core';

export async function GET() {
  const profiles = detectChromeProfiles();
  return NextResponse.json({ profiles });
}
