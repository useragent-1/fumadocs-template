import { NextResponse } from 'next/server';
import { verifyAuth, getFileContent, deleteGithubFile } from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Check Authentication
    if (!verifyAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { path } = body;

    if (!path) {
      return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    // 3. Read current SHA from GitHub to make sure it exists and to get the correct SHA
    let sha: string;
    try {
      const existingFile = await getFileContent(path);
      sha = existingFile.sha;
    } catch (error: any) {
      if (error.message.includes('File not found')) {
        return NextResponse.json({ error: `File not found: ${path}` }, { status: 404 });
      }
      throw error;
    }

    // 4. Delete the file from GitHub
    await deleteGithubFile(path, sha, `docs: delete ${path}`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${path}`,
    });
  } catch (error: any) {
    console.error('Error in POST /api/docs/delete:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
