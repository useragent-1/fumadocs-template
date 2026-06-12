import { NextResponse } from 'next/server';
import { verifyAuth, writeGithubFile, stringifyFrontmatter, getPathFromSlug, getFileContent } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Check Authentication
    if (!verifyAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { slug, title, description, content } = body;

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const path = getPathFromSlug(slug);

    // 3. Check if file already exists
    let exists = false;
    try {
      await getFileContent(path);
      exists = true;
    } catch (error: any) {
      // If error is "File not found", it means we can create it
      if (!error.message.includes('File not found')) {
        throw error;
      }
    }

    if (exists) {
      return NextResponse.json(
        { error: `Document with slug '${slug}' already exists` },
        { status: 400 }
      );
    }

    // 4. Stringify content with frontmatter
    const frontmatter = {
      title: title || slug,
      description: description || '',
    };
    const fullMDX = stringifyFrontmatter(frontmatter, content || '');

    // 5. Write to GitHub
    const result = await writeGithubFile(path, fullMDX, undefined, `docs: create ${slug}`);

    return NextResponse.json({
      success: true,
      path,
      slug,
      sha: result.sha,
    });
  } catch (error: any) {
    console.error('Error in POST /api/docs/create:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
