import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { getAIProvider } from '@/lib/ai';
import { indexBookmarks } from '@bookmark-hub/indexer';

declare global {
  // eslint-disable-next-line no-var
  var indexingStopRequested: boolean | undefined;
}

export async function DELETE() {
  if (globalThis.indexingStatus?.active) {
    globalThis.indexingStopRequested = true;
    return NextResponse.json({ ok: true, status: 'stopping' });
  }
  return NextResponse.json({ ok: true, status: 'idle' });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    limit = 1000,
    onlyMissing = true,
    useAI = true,
    fetchContent = true,
    fetchTimeout = 10000,
    background = true,
    stop = false,
  } = body;

  if (stop) {
    if (globalThis.indexingStatus?.active) {
      globalThis.indexingStopRequested = true;
      return NextResponse.json({ ok: true, status: 'stopping' });
    }
    return NextResponse.json({ ok: true, status: 'idle' });
  }

  if (globalThis.indexingStatus?.active) {
    return NextResponse.json({ ok: false, error: 'AI 分析任务已经在运行中' }, { status: 400 });
  }

  const db = getDB();
  const provider = getAIProvider();

  globalThis.indexingStopRequested = false;
  globalThis.indexingStatus = {
    active: true,
    done: 0,
    total: 0,
    currentTitle: '正在准备数据...',
  };

  const runTask = async () => {
    try {
      await indexBookmarks(db, provider, {
        limit,
        onlyMissing,
        useAI,
        fetchContent,
        fetchTimeout,
        onProgress: (done, total, bookmark) => {
          if (globalThis.indexingStopRequested) {
            throw new Error('INDEXING_STOPPED_BY_USER');
          }
          globalThis.indexingStatus = {
            active: true,
            done,
            total,
            currentTitle: bookmark.title || bookmark.url || '未知网页',
          };
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'INDEXING_STOPPED_BY_USER') {
        console.log('Indexing paused by user.');
      } else {
        console.error('Background indexing error:', err);
      }
    } finally {
      globalThis.indexingStopRequested = false;
      globalThis.indexingStatus = {
        active: false,
        done: 0,
        total: 0,
        currentTitle: '',
      };
    }
  };

  if (background) {
    runTask();
    return NextResponse.json({ ok: true, status: 'started' });
  } else {
    await runTask();
    return NextResponse.json({ ok: true, status: 'completed' });
  }
}
