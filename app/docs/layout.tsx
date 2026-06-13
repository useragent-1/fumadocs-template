import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import type { ReactNode } from 'react';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';
import Link from 'next/link';
import { SquarePen } from 'lucide-react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      {...baseOptions()}
      // Enable sidebar search
      sidebar={{
        defaultOpenLevel: 1,
        banner: (
          <Link
            href="/admin/docs"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs font-semibold text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white bg-slate-100 dark:bg-zinc-900 hover:bg-slate-200/80 dark:hover:bg-zinc-800/80 rounded-lg transition-all border border-slate-200 dark:border-zinc-800 shadow-sm mb-2"
          >
            <SquarePen className="w-3.5 h-3.5" />
            <span>写文章</span>
          </Link>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
