import { NextResponse } from 'next/server';
import {
  verifyAuth,
  writeGithubFile,
  deleteGithubFile,
  stringifyFrontmatter,
  getPathFromSlug,
  getFileContent
} from '@/lib/github';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Check Authentication
    if (!verifyAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { path: oldPath, slug: newSlug, title, description, content } = body;

    if (!oldPath || !newSlug) {
      return NextResponse.json({ error: 'Original path and new slug are required' }, { status: 400 });
    }

    const newPath = getPathFromSlug(newSlug);

    // Format MDX content with frontmatter
    const frontmatter = {
      title: title || newSlug,
      description: description || '',
    };
    const fullMDX = stringifyFrontmatter(frontmatter, content || '');

    let newSha: string | undefined;

    // 3. Handle Rename vs Simple Update
    if (newPath !== oldPath) {
      console.log(`Renaming file from ${oldPath} to ${newPath}`);

      // Check if newPath already exists to get its SHA (if overwriting an existing one)
      try {
        const existingFile = await getFileContent(newPath);
        newSha = existingFile.sha;
      } catch (error: any) {
        if (!error.message.includes('File not found')) {
          throw error;
        }
      }

      // Write the new file
      const writeResult = await writeGithubFile(
        newPath,
        fullMDX,
        newSha,
        `docs: move and update from ${oldPath} to ${newSlug}`
      );

      // Fetch the old file's SHA to delete it cleanly
      let oldSha: string | undefined;
      try {
        const oldFile = await getFileContent(oldPath);
        oldSha = oldFile.sha;
      } catch (error: any) {
        console.error(`Old file not found for deletion during rename: ${oldPath}`, error);
      }

      if (oldSha) {
        // Delete the old file
        await deleteGithubFile(oldPath, oldSha, `docs: clean up renamed file ${oldPath}`);
      }

      return NextResponse.json({
        success: true,
        path: newPath,
        slug: newSlug,
        sha: writeResult.sha,
        renamed: true,
      });
    } else {
      // Simple update
      // Fetch the current SHA from GitHub first to avoid conflicts
      const existingFile = await getFileContent(oldPath);
      const currentSha = existingFile.sha;

      // Update the file
      const writeResult = await writeGithubFile(
        oldPath,
        fullMDX,
        currentSha,
        `docs: update ${newSlug}`
      );

      return NextResponse.json({
        success: true,
        path: oldPath,
        slug: newSlug,
        sha: writeResult.sha,
        renamed: false,
      });
    }
  } catch (error: any) {
    console.error('Error in POST /api/docs/update:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
