import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import archiver from 'archiver';
import { promises as fs } from 'fs';
import path from 'path';

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

export async function POST(request: NextRequest) {
  try {
    await ensureDirs();
    await cleanupExpiredZips();
    
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];
    const aspectRatioStr = formData.get('aspectRatio') as string || '16:9';
    const rows = parseInt(formData.get('rows') as string) || 2;
    const cols = parseInt(formData.get('cols') as string) || 2;
    const outputFormat = (formData.get('outputFormat') as string) || 'jpg';
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No images uploaded' },
        { status: 400 }
      );
    }
    
    if (rows < 1 || rows > 20 || cols < 1 || cols > 20) {
      return NextResponse.json(
        { error: 'Rows and columns must be between 1 and 20' },
        { status: 400 }
      );
    }
    
    const aspectRatio = parseAspectRatio(aspectRatioStr);
    const targetAspectRatio = aspectRatio.width / aspectRatio.height;
    
    // Create unique session ID for this operation
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sessionDir = path.join(TEMP_DIR, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    
    const cutImages: { filename: string; buffer: Buffer }[] = [];
    let totalSegments = 0;
    
    // Process each uploaded image
    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx];
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Get image dimensions
      const metadata = await sharp(buffer).metadata();
      const imgWidth = metadata.width || 1920;
      const imgHeight = metadata.height || 1080;
      
      // Calculate cell dimensions (evenly distributed across the image)
      const cellWidth = Math.floor(imgWidth / cols);
      const cellHeight = Math.floor(imgHeight / rows);
      
      // Calculate the segment dimensions within each cell based on aspect ratio
      // The segment should fit within the cell while maintaining the target aspect ratio
      let segmentWidth: number;
      let segmentHeight: number;
      
      const cellAspectRatio = cellWidth / cellHeight;
      
      if (cellAspectRatio > targetAspectRatio) {
        // Cell is wider than target - constrain by height
        segmentHeight = cellHeight;
        segmentWidth = Math.floor(cellHeight * targetAspectRatio);
      } else {
        // Cell is taller than target - constrain by width
        segmentWidth = cellWidth;
        segmentHeight = Math.floor(cellWidth / targetAspectRatio);
      }
      
      // Cut the image into segments
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          // Calculate cell position
          const cellLeft = col * cellWidth;
          const cellTop = row * cellHeight;
          
          // Center the segment within the cell
          const offsetX = Math.floor((cellWidth - segmentWidth) / 2);
          const offsetY = Math.floor((cellHeight - segmentHeight) / 2);
          
          const left = cellLeft + offsetX;
          const top = cellTop + offsetY;
          
          // Extract segment with the target aspect ratio
          let segment = sharp(buffer).extract({
            left: Math.max(0, left),
            top: Math.max(0, top),
            width: Math.min(segmentWidth, imgWidth - left),
            height: Math.min(segmentHeight, imgHeight - top)
          });
          
          // Convert to requested format
          let outputBuffer: Buffer;
          const ext = outputFormat === 'png' ? 'png' : 'jpg';
          
          if (outputFormat === 'png') {
            outputBuffer = await segment.png({ quality: 100 }).toBuffer();
          } else {
            outputBuffer = await segment.jpeg({ quality: 95 }).toBuffer();
          }
          
          const segmentNum = row * cols + col + 1;
          const filename = `image_${String(fileIdx + 1).padStart(2, '0')}_row${String(row + 1).padStart(2, '0')}_col${String(col + 1).padStart(2, '0')}.${ext}`;
          cutImages.push({ filename, buffer: outputBuffer });
          
          totalSegments++;
        }
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
        'X-Total-Segments': String(totalSegments),
        'X-Grid-Cols': String(cols),
        'X-Grid-Rows': String(rows)
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
