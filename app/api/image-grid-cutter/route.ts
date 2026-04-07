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
    const mode = (formData.get('mode') as string) || 'grid'; // 'grid' or 'auto'
    const regionsJson = formData.get('regions') as string || '[]';
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No images uploaded' },
        { status: 400 }
      );
    }
    
    if (mode === 'grid' && (rows < 1 || rows > 20 || cols < 1 || cols > 20)) {
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
    let effectiveRows = rows;
    let effectiveCols = cols;
    
    // Parse regions for auto mode
    let regions: Array<{ x: number; y: number; w: number; h: number; label?: string }> = [];
    if (mode === 'auto') {
      try {
        regions = JSON.parse(regionsJson);
      } catch {
        return NextResponse.json({ error: 'Invalid regions data' }, { status: 400 });
      }
      if (regions.length === 0) {
        return NextResponse.json({ error: 'No detected regions provided' }, { status: 400 });
      }
      effectiveRows = regions.length;
      effectiveCols = 1;
    }
    
    // Process each uploaded image
    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const file = files[fileIdx];
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Get image dimensions
      const metadata = await sharp(buffer).metadata();
      const imgWidth = metadata.width || 1920;
      const imgHeight = metadata.height || 1080;
      
      if (mode === 'auto') {
        // Auto mode: extract each detected region
        for (let i = 0; i < regions.length; i++) {
          const region = regions[i];
          
          // Convert normalized coordinates (0-1) to pixel coordinates
          const left = Math.max(0, Math.round(region.x * imgWidth));
          const top = Math.max(0, Math.round(region.y * imgHeight));
          let extractWidth = Math.round(region.w * imgWidth);
          let extractHeight = Math.round(region.h * imgHeight);
          
          // Clamp to image bounds
          extractWidth = Math.min(extractWidth, imgWidth - left);
          extractHeight = Math.min(extractHeight, imgHeight - top);
          
          if (extractWidth < 1 || extractHeight < 1) continue;
          
          // Extract the detected region
          let segment = sharp(buffer).extract({
            left,
            top,
            width: extractWidth,
            height: extractHeight
          });
          
          // Step 1: Crop to target aspect ratio and materialize to buffer
          const outputWidth = extractWidth;
          const outputHeight = Math.round(extractWidth / targetAspectRatio);
          
          const croppedBuffer = await segment.resize({
            width: outputWidth,
            height: outputHeight,
            fit: 'cover',
            position: 'center'
          }).toBuffer();
          
          // Step 2: Upscale 4x on a fresh Sharp instance (lanczos3 = highest quality kernel)
          const upscaledWidth = outputWidth * 4;
          const upscaledHeight = outputHeight * 4;
          const upscaled = sharp(croppedBuffer).resize({
            width: upscaledWidth,
            height: upscaledHeight,
            kernel: 'lanczos3',
            fit: 'fill',
            fastShrinkOnLoad: false
          });
          
          // Convert to requested format at maximum quality
          let outputBuffer: Buffer;
          const ext = outputFormat === 'png' ? 'png' : 'jpg';
          
          if (outputFormat === 'png') {
            outputBuffer = await upscaled.png({ compressionLevel: 0, effort: 10 }).toBuffer();
          } else {
            outputBuffer = await upscaled.jpeg({ quality: 100, chromaSubsampling: '4:4:4', trellisQuantisation: true, overshootDeringing: true, optimizeCoding: true }).toBuffer();
          }
          
          const filename = `image_${String(fileIdx + 1).padStart(2, '0')}_detected_${String(i + 1).padStart(2, '0')}.${ext}`;
          cutImages.push({ filename, buffer: outputBuffer });
          totalSegments++;
        }
      } else {
        // Grid mode: original behavior
        const cellWidth = Math.floor(imgWidth / cols);
        const cellHeight = Math.floor(imgHeight / rows);
        
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const left = col * cellWidth;
            const top = row * cellHeight;
            
            const extractWidth = (col === cols - 1) ? imgWidth - left : cellWidth;
            const extractHeight = (row === rows - 1) ? imgHeight - top : cellHeight;
            
            let segment = sharp(buffer).extract({
              left,
              top,
              width: extractWidth,
              height: extractHeight
            });
            
            const outputWidth = extractWidth;
            const outputHeight = Math.round(extractWidth / targetAspectRatio);
            
            // Step 1: Crop to target aspect ratio and materialize to buffer
            const croppedBuffer = await segment.resize({
              width: outputWidth,
              height: outputHeight,
              fit: 'cover',
              position: 'center'
            }).toBuffer();
            
            // Step 2: Upscale 4x on a fresh Sharp instance (lanczos3 = highest quality kernel)
            const upscaledWidth = outputWidth * 4;
            const upscaledHeight = outputHeight * 4;
            const upscaled = sharp(croppedBuffer).resize({
              width: upscaledWidth,
              height: upscaledHeight,
              kernel: 'lanczos3',
              fit: 'fill',
              fastShrinkOnLoad: false
            });
            
            // Convert to requested format at maximum quality
            let outputBuffer: Buffer;
            const ext = outputFormat === 'png' ? 'png' : 'jpg';
            
            if (outputFormat === 'png') {
              outputBuffer = await upscaled.png({ compressionLevel: 0, effort: 10 }).toBuffer();
            } else {
              outputBuffer = await upscaled.jpeg({ quality: 100, chromaSubsampling: '4:4:4', trellisQuantisation: true, overshootDeringing: true, optimizeCoding: true }).toBuffer();
            }
            
            const filename = `image_${String(fileIdx + 1).padStart(2, '0')}_row${String(row + 1).padStart(2, '0')}_col${String(col + 1).padStart(2, '0')}.${ext}`;
            cutImages.push({ filename, buffer: outputBuffer });
            totalSegments++;
          }
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
    
    // Delete ZIP file immediately after reading
    await fs.unlink(zipPath).catch(() => {});
    
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'X-Zip-Filename': zipFilename,
        'X-Total-Segments': String(totalSegments),
        'X-Grid-Cols': String(effectiveCols),
        'X-Grid-Rows': String(effectiveRows),
        'X-Cut-Mode': mode
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
