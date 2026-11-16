import { NextResponse } from 'next/server';

export interface GlobalIndexingStatus {
  active: boolean;
  done: number;
  total: number;
  currentTitle: string;
}

declare global {
  // eslint-disable-next-line no-var
  var indexingStatus: GlobalIndexingStatus | undefined;
}

export async function GET() {
  const status: GlobalIndexingStatus = globalThis.indexingStatus ?? {
    active: false,
    done: 0,
    total: 0,
    currentTitle: '',
  };
  return NextResponse.json(status);
}
