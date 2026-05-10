export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { getLLMConfig } from '@/lib/llm';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const POOL_BASE = path.join(DATA_DIR, 'category-images', 'pool');

interface Region { x: number; y: number; w: number; h: number; label?: string }

async function fetchImageBuffer(urlOrPath: string, origin: string): Promise<Buffer> {
  // 1. Pool uploads stored on disk at /api/category-images/pool/<rel>
  if (urlOrPath.startsWith('/api/category-images/pool/')) {
    const rel = urlOrPath.replace('/api/category-images/pool/', '');
    const localPath = path.join(POOL_BASE, rel);
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }
  }

  // 2. Storyboard / gallery images served via /api/images?path=<relative>
  //    These are auth-protected so we read from disk directly to avoid 401.
  if (urlOrPath.startsWith('/api/images?path=') || urlOrPath.startsWith('/api/images?')) {
    const urlObj = new URL(urlOrPath, 'http://localhost');
    const relPath = urlObj.searchParams.get('path');
    if (relPath) {
      const localPath = path.join(DATA_DIR, relPath);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    }
  }

  // 3. Legacy path-style /api/images/<relative> (shouldn't happen after heal, but handle it)
  if (urlOrPath.startsWith('/api/images/') && !urlOrPath.startsWith('/api/images?')) {
    const rel = urlOrPath.replace(/^\/api\/images\//, '');
    if (rel) {
      const localPath = path.join(DATA_DIR, rel);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    }
  }

  // 4. Else fetch via HTTP (external URLs)
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${origin}${urlOrPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} from ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Sanity check: reject HTML/XML responses that aren't real images
  const head = buf.slice(0, 20).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<?xml')) {
    throw new Error(`Received HTML/XML instead of image data from ${url}`);
  }
  return buf;
}

async function detectRegions(buffer: Buffer, mimeType: string, gridSize: number): Promise<Region[]> {
  // First try Gemini Vision detection
  try {
    const meta = await sharp(buffer).metadata();
    const imgWidth = meta.width || 1920;
    const imgHeight = meta.height || 1080;

    let llmBuffer = buffer;
    if (Math.max(imgWidth, imgHeight) > 2000) {
      llmBuffer = await sharp(buffer)
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 }).toBuffer();
    }
    const base64Image = llmBuffer.toString('base64');
    const llm = await getLLMConfig();

    const response = await fetch(llm.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llm.apiKey}` },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          { role: 'system', content: `You are an expert image analysis AI. Detect each individual picture/photo/frame within a composite image (grid/collage). Return tightly-cropped bounding boxes as normalized coordinates (0.0-1.0). Order left-to-right, top-to-bottom. Respond JSON only: {"regions":[{"x":0,"y":0,"w":0.5,"h":0.5}]}` },
          { role: 'user', content: [
            { type: 'text', text: `Detect all individual pictures in this image. The image is approximately ${gridSize === 4 ? '2x2' : '3x3'} grid.` },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ] },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 2000,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      let content = data.choices?.[0]?.message?.content || '';
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(content);
      const regions: Region[] = (parsed.regions || []).map((r: Region) => ({
        x: Math.max(0, Math.min(1, r.x)),
        y: Math.max(0, Math.min(1, r.y)),
        w: Math.max(0.01, Math.min(1 - r.x, r.w)),
        h: Math.max(0.01, Math.min(1 - r.y, r.h)),
      }));
      if (regions.length === gridSize) return regions;
    }
  } catch (err) {
    console.warn('Gemini detection failed, falling back to grid:', err);
  }

  // Fallback: uniform grid
  const rows = gridSize === 4 ? 2 : 3;
  const cols = gridSize === 4 ? 2 : 3;
  const regions: Region[] = [];
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      regions.push({ x: c * cellW, y: r * cellH, w: cellW, h: cellH });
    }
  }
  return regions;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { poolImageId, prompt, projectId, origin } = body;
    if (!poolImageId || !prompt || !projectId) {
      return NextResponse.json({ error: 'poolImageId, prompt, projectId required' }, { status: 400 });
    }

    const poolImage = await prisma.poolImage.findUnique({ where: { id: poolImageId } });
    if (!poolImage) return NextResponse.json({ error: 'Pool image not found' }, { status: 404 });
    if (!poolImage.isMultiImage || (poolImage.gridSize !== 4 && poolImage.gridSize !== 9)) {
      return NextResponse.json({ error: 'Image is not flagged as multi-image (4 or 9)' }, { status: 400 });
    }

    const baseOrigin = origin || request.nextUrl.origin;
    const buffer = await fetchImageBuffer(poolImage.imagePath, baseOrigin);
    const meta = await sharp(buffer).metadata();
    const imgWidth = meta.width || 1920;
    const imgHeight = meta.height || 1080;
    const ext = (poolImage.fileName.split('.').pop() || 'png').toLowerCase();
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';

    const regions = await detectRegions(buffer, mimeType, poolImage.gridSize);
    if (!regions.length) return NextResponse.json({ error: 'No regions detected' }, { status: 500 });

    const upscale = poolImage.gridSize === 4 ? 2 : 3;
    const cellsDir = path.join(POOL_BASE, projectId, 'cells');
    if (!fs.existsSync(cellsDir)) fs.mkdirSync(cellsDir, { recursive: true });

    const cellUrls: string[] = [];
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      const left = Math.max(0, Math.round(r.x * imgWidth));
      const top = Math.max(0, Math.round(r.y * imgHeight));
      let w = Math.round(r.w * imgWidth);
      let h = Math.round(r.h * imgHeight);
      w = Math.min(w, imgWidth - left);
      h = Math.min(h, imgHeight - top);
      if (w < 8 || h < 8) continue;

      const cropped = await sharp(buffer).extract({ left, top, width: w, height: h }).toBuffer();
      const upW = w * upscale;
      const upH = h * upscale;
      const upBuf = await sharp(cropped)
        .resize({ width: upW, height: upH, kernel: 'lanczos3', fit: 'fill', fastShrinkOnLoad: false })
        .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
        .toBuffer();

      const cellName = `${randomUUID()}.jpg`;
      fs.writeFileSync(path.join(cellsDir, cellName), upBuf);
      cellUrls.push(`/api/category-images/pool/${projectId}/cells/${cellName}`);
    }

    if (!cellUrls.length) return NextResponse.json({ error: 'No valid cells produced' }, { status: 500 });

    // Create one DirectorVideo per cell. Generation is triggered client-side for each.
    const maxSort = await prisma.directorVideo.aggregate({
      where: { projectId, deleted: false }, _max: { sortOrder: true },
    });
    let nextSort = (maxSort._max.sortOrder ?? -1) + 1;

    const created = [];
    for (let i = 0; i < cellUrls.length; i++) {
      const v = await prisma.directorVideo.create({
        data: {
          projectId,
          prompt,
          startFrameUrl: cellUrls[i],
          sortOrder: nextSort++,
          metadata: { sourcePoolImageId: poolImage.id, cellIndex: i, totalCells: cellUrls.length },
        },
      });
      created.push(v);
    }

    return NextResponse.json({ success: true, videos: created, cellUrls });
  } catch (error) {
    console.error('Multi-generate error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}
