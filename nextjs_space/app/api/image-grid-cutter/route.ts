import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import archiver from 'archiver';
import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';

const TEMP_DIR = '/tmp/image-grid-cutter';
const ZIP_DIR = '/tmp/image-grid-zips';
const ZIP_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

// Ensure directories exist
async function ensureDirs() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(ZIP_DIR, { recursive: true });
}

// Clean up expired ZIP files
async function cleanupExpiredZips() {
  try {
    const files = await fs.readdir(ZIP_DIR);
    const now = Date.now();
    
    for (const file of files) {
      if (file.endsWith('.zip')) {
        const filePath = path.join(ZIP_DIR, file);
        const stats = await fs.stat(filePath);
        const age = now - stats.mtimeMs;
        
        if (age > ZIP_EXPIRY_MS) {
          await fs.unlink(filePath);
          console.log(`Cleaned up expired ZIP: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Parse aspect ratio string (e.g., "16:9", "4:3", "1:1")
function parseAspectRatio(ratio: string): { width: number; height: number } {
  const [w, h] = ratio.split(':').map(Number);
  if (!w || !h || isNaN(w) || isNaN(h)) {
    return { width: 16, height: 9 }; // Default
  }
  return { width: w, height: h };
}

// Calculate grid dimensions based on total count and aspect ratio
function calculateGridDimensions(totalCount: number, aspectRatio: { width: number; height: number }): { cols: number; rows: number } {
  // Find the best grid that matches the aspect ratio
  const targetRatio = aspectRatio.width / aspectRatio.height;
  
  let bestCols = 1;
  let bestRows = totalCount;
  let bestRatioDiff = Infinity;
  
  for (let cols = 1; cols <= totalCount; cols++) {
    const rows = Math.ceil(totalCount / cols);
    const gridRatio = cols / rows;
    const ratioDiff = Math.abs(gridRatio - targetRatio);
    
    if (ratioDiff < bestRatioDiff && cols * rows >= totalCount) {
      bestRatioDiff = ratioDiff;
      bestCols = cols;
      bestRows = rows;
    }
  }
  
  return { cols: bestCols, rows: bestRows };
}

export async function POST(request: NextRequest) {
  try {
    await ensureDirs();
    await cleanupExpiredZips();
    
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];
    const aspectRatioStr = formData.get('aspectRatio') as string || '16:9';
    const totalCount = parseInt(formData.get('totalCount') as string) || 4;
    const outputFormat = (formData.get('outputFormat') as string) || 'jpg';
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No images uploaded' },
        { status: 400 }
      );
    }
    
    if (totalCount < 1 || totalCount > 100) {
      return NextResponse.json(
        { error: 'Total count must be between 1 and 100' },
        { status: 400 }
      );
    }
    
    const aspectRatio = parseAspectRatio(aspectRatioStr);
    const grid = calculateGridDimensions(totalCount, aspectRatio);
    
    // Create unique session ID for this operation
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sessionDir = path.join(TEMP_DIR, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    
    const cutImages: { filename: string; buffer: Buffer }[] = [];
    let imageIndex = 0;
    
    // Process each uploaded image
    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx];
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Get image dimensions
      const metadata = await sharp(buffer).metadata();
      const imgWidth = metadata.width || 1920;
      const imgHeight = metadata.height || 1080;
      
      // Calculate segment dimensions
      const segmentWidth = Math.floor(imgWidth / grid.cols);
      const segmentHeight = Math.floor(imgHeight / grid.rows);
      
      // Cut the image into segments
      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.cols; col++) {
          if (imageIndex >= totalCount) break;
          
          const left = col * segmentWidth;
          const top = row * segmentHeight;
          
          // Extract segment
          let segment = sharp(buffer).extract({
            left,
            top,
            width: segmentWidth,
            height: segmentHeight
          });
          
          // Convert to requested format
          let outputBuffer: Buffer;
          const ext = outputFormat === 'png' ? 'png' : 'jpg';
          
          if (outputFormat === 'png') {
            outputBuffer = await segment.png({ quality: 100 }).toBuffer();
          } else {
            outputBuffer = await segment.jpeg({ quality: 95 }).toBuffer();
          }
          
          const filename = `image_${String(fileIdx + 1).padStart(2, '0')}_segment_${String(imageIndex + 1).padStart(3, '0')}.${ext}`;
          cutImages.push({ filename, buffer: outputBuffer });
          
          imageIndex++;
        }
        if (imageIndex >= totalCount) break;
      }
    }
    
    // Create ZIP file
    const zipFilename = `grid-cut-${sessionId}.zip`;
    const zipPath = path.join(ZIP_DIR, zipFilename);
    
    await new Promise<void>((resolve, reject) => {
      const output = require('fs').createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', resolve);
      archive.on('error', reject);
      
      archive.pipe(output);
      
      for (const img of cutImages) {
        archive.append(img.buffer, { name: img.filename });
      }
      
      archive.finalize();
    });
    
    // Clean up session directory
    await fs.rm(sessionDir, { recursive: true, force: true });
    
    // Read ZIP file and return
    const zipBuffer = await fs.readFile(zipPath);
    
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'X-Zip-Filename': zipFilename,
        'X-Total-Segments': String(cutImages.length),
        'X-Grid-Cols': String(grid.cols),
        'X-Grid-Rows': String(grid.rows)
      }
    });
  } catch (error) {
    console.error('Image grid cutter error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process images' },
      { status: 500 }
    );
  }
}

// GET endpoint to download a previously created ZIP
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    const zipPath = path.join(ZIP_DIR, filename);
    
    try {
      const stats = await fs.stat(zipPath);
      const age = Date.now() - stats.mtimeMs;
      
      if (age > ZIP_EXPIRY_MS) {
        await fs.unlink(zipPath);
        return NextResponse.json(
          { error: 'ZIP file has expired' },
          { status: 410 }
        );
      }
      
      const zipBuffer = await fs.readFile(zipPath);
      
      return new Response(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      });
    } catch {
      return NextResponse.json(
        { error: 'ZIP file not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('ZIP download error:', error);
    return NextResponse.json(
      { error: 'Failed to download ZIP' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to manually delete a ZIP
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('file');
    
    if (!filename || filename.includes('..') || filename.includes('/') || !filename.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    const zipPath = path.join(ZIP_DIR, filename);
    
    try {
      await fs.unlink(zipPath);
      return NextResponse.json({ success: true, message: 'ZIP deleted' });
    } catch {
      return NextResponse.json(
        { error: 'ZIP file not found' },
        { status: 404 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete ZIP' },
      { status: 500 }
    );
  }
}
