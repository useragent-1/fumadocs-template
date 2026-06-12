import { NextResponse } from 'next/server';
import { verifyAuth, getGitTree, getFileContent, parseFrontmatter, getSlugFromPath } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Check Authentication
    if (!verifyAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch Git Tree
    const tree = await getGitTree();

    // 3. Filter for MDX files in content/docs/
    const mdxFiles = tree.filter(
      (node) => node.type === 'blob' && node.path.startsWith('content/docs/') && node.path.endsWith('.mdx')
    );

    // 4. Fetch content for all MDX files in parallel
    const docs = await Promise.all(
      mdxFiles.map(async (file) => {
        try {
          const { content, sha } = await getFileContent(file.path);
          const { frontmatter, body } = parseFrontmatter(content);
          
          return {
            path: file.path,
            slug: getSlugFromPath(file.path),
            sha,
            title: frontmatter.title || getSlugFromPath(file.path),
            description: frontmatter.description || '',
            content: body,
          };
        } catch (error: any) {
          console.error(`Failed to fetch content for ${file.path}:`, error);
          // Return a placeholder or partial details if fetch fails
          return {
            path: file.path,
            slug: getSlugFromPath(file.path),
            sha: file.sha,
            title: getSlugFromPath(file.path),
            description: 'Failed to load content',
            content: '',
            error: error.message,
          };
        }
      })
    );

    return NextResponse.json(docs);
  } catch (error: any) {
    console.error('Error in GET /api/docs/list:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
