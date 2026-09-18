import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  persistProjectDocument,
  listProjectDocuments,
  type DocType,
} from '@/lib/document-storage';

export const dynamic = 'force-dynamic';

const VALID_DOC_TYPES: DocType[] = ['screenplay', 'novel', 'audio-drama', 'voiceover', 'storyboard-pdf'];

async function assertOwner(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
}

// GET - list saved shareable documents for a project
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const owned = await assertOwner(projectId, session.user.id);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const documents = await listProjectDocuments(projectId);
    return NextResponse.json({ documents });
  } catch (error) {
    console.error('List project documents error:', error);
    return NextResponse.json({ error: 'Failed to list documents' }, { status: 500 });
  }
}

// POST - persist an uploaded document blob (e.g. client-built storyboard PDF)
// Accepts JSON { projectId, docType, format, title, dataBase64 }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { projectId, docType, format, title, dataBase64 } = await request.json();
    if (!projectId || !docType || !dataBase64) {
      return NextResponse.json({ error: 'projectId, docType and dataBase64 are required' }, { status: 400 });
    }
    if (!VALID_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: 'Invalid docType' }, { status: 400 });
    }
    const owned = await assertOwner(projectId, session.user.id);
    if (!owned) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const fmt = (format || 'pdf').toLowerCase();
    const b64 = String(dataBase64).replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Empty file' }, { status: 400 });
    }
    const contentType = fmt === 'pdf'
      ? 'application/pdf'
      : 'application/octet-stream';

    const persisted = await persistProjectDocument(
      projectId, docType as DocType, fmt, title || docType, buffer, contentType,
    );
    if (!persisted) {
      return NextResponse.json({
        error: 'Cloud storage is not configured. Set up BunnyCDN in Admin → API Config to enable shareable links.',
        cdnUrl: null,
      }, { status: 200 });
    }
    return NextResponse.json({ cdnUrl: persisted.cdnUrl, document: persisted });
  } catch (error) {
    console.error('Persist project document error:', error);
    return NextResponse.json({ error: 'Failed to persist document' }, { status: 500 });
  }
}
