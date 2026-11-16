'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { WelcomeCard } from '@/components/welcome-card';

export default function HelpPage() {
  const { locale } = useI18n();
  const english = locale === 'en';
  const steps = english ? [
    { title: 'Import bookmarks', description: 'Export a bookmarks HTML file from your browser and select it on the import page. To sync changes back to Chrome later, import through the Chrome extension.', href: '/import', action: 'Import bookmarks' },
    { title: 'Find and browse', description: 'Browse your library or search by title, link, or keyword. Use folders and tags to narrow your results.', href: '/library', action: 'Open my bookmarks' },
    { title: 'Review suggestions', description: 'Generate suggestions, then review and accept or dismiss them. Accepted changes are saved locally for review.', href: '/rescue', action: 'Open organize' },
    { title: 'Preview before Chrome sync', description: 'Preview accepted changes in the sync plan, then use the Chrome extension to confirm and apply them to Chrome.', href: '/rescue', action: 'View organize and sync' },
  ] : [
    { title: '导入书签', description: '从浏览器导出书签 HTML 文件，然后在导入页面选择该文件。如果之后希望将整理结果写回 Chrome，建议通过 Chrome 扩展导入。', href: '/import', action: '前往导入书签' },
    { title: '查找和浏览', description: '在书签库中浏览，或使用标题、链接和关键词搜索。也可以通过文件夹和标签缩小范围。', href: '/library', action: '打开我的书签' },
    { title: '审查整理建议', description: '生成整理建议后，逐项查看并接受或忽略。接受的改动先保存在本地，供你审查。', href: '/rescue', action: '打开整理建议' },
    { title: '预览后同步到 Chrome', description: '先在同步计划中预览已接受的改动，再通过 Chrome 扩展确认并应用到浏览器。', href: '/rescue', action: '查看整理与同步' },
  ];
  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <WelcomeCard />
      <header className="rounded-lg border border-[#E1D9C9] bg-white p-6">
        <h1 className="text-xl font-bold text-[#23372B]">{english ? 'Help & Guide' : '帮助与指南'}</h1>
        <p className="mt-2 text-sm leading-6 text-[#59634F]">{english ? 'Learn the main steps for importing, finding, and organizing your bookmarks.' : '了解如何导入、查找和整理书签。你可以随时回来查看。'}</p>
      </header>
      <section aria-label={english ? 'Getting started' : '使用步骤'} className="space-y-3">
        {steps.map((step, index) => (
          <article key={step.title} className="flex gap-4 rounded-lg border border-[#E1D9C9] bg-white p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE9DF] text-sm font-semibold text-[#23372B]">{index + 1}</span>
            <div>
              <h2 className="text-sm font-semibold text-[#23372B]">{step.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-[#59634F]">{step.description}</p>
              <Link href={step.href} className="mt-3 inline-block text-sm font-semibold text-[#294435] underline underline-offset-4">{step.action}</Link>
            </div>
          </article>
        ))}
      </section>
      <section className="rounded-lg border border-[#E1D9C9] bg-[#EEE9DF] p-5 text-sm leading-6 text-[#23372B]">
        <h2 className="font-semibold">{english ? 'Your data and AI' : '数据与 AI'}</h2>
        <p className="mt-1">{english ? 'Bookmarks are stored locally. Mock mode does not call an AI provider; external services are used when configured and an operation is requested.' : '书签默认保存在本地。Mock 模式不会调用 AI 服务；配置外部服务并执行相关操作时，才会使用该服务。'}</p>
        <Link href="/settings" className="mt-2 inline-block font-semibold underline underline-offset-4">{english ? 'Open AI Provider Center' : '打开 AI 接入中心'}</Link>
      </section>
    </div>
  );
}
