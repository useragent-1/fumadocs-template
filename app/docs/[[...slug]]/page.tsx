import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound, redirect } from 'next/navigation';
import { useMDXComponents } from '@/mdx-components';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  
  if (!page) {
    // 如果根路径 /docs 找不到对应的 index.mdx（比如被重命名或删除了），
    // 则自动重定向到左侧列表中第一个可用的文档页面，避免出现 404
    if (!params.slug || params.slug.length === 0) {
      const allPages = source.getPages();
      if (allPages.length > 0) {
        redirect(allPages[0].url);
      }
    }
    notFound();
  }

  const MDX = page.data.body;
  const components = useMDXComponents({});

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      // Enable table of contents
      tableOfContent={{
        enabled: true,
        style: 'clerk',
      }}
      // Disable breadcrumb
      breadcrumb={{
        enabled: false,
      }}
    >
      <DocsBody>
        <MDX components={components} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  const params = source.generateParams();
  return [{ slug: [] }, ...params];
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    return {
      title: '文档中心',
      description: '在线文档中心',
    };
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
