import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getLLMConfig } from '@/lib/llm';
import { trackUsage } from '@/lib/usage-tracker';

export const dynamic = 'force-dynamic';

/**
 * Detect individual images within a composite/grid image using Gemini Vision.
 * Returns normalized bounding boxes (0-1 range) for each detected sub-image.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;

    if (!file) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Get image dimensions for reference
    const metadata = await sharp(buffer).metadata();
    const imgWidth = metadata.width || 1920;
    const imgHeight = metadata.height || 1080;

    // Resize for LLM if very large (keep under ~2000px for faster processing)
    let llmBuffer = buffer;
    const maxDim = Math.max(imgWidth, imgHeight);
    if (maxDim > 2000) {
      llmBuffer = await sharp(buffer)
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    }

    const base64Image = llmBuffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const llm = await getLLMConfig();

    const response = await fetch(llm.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert image analysis AI. Your task is to detect individual distinct pictures/photos/frames within a composite image (such as a grid, collage, storyboard, or contact sheet).

Analyze the image and identify each separate picture within it. For each detected picture, return its bounding box as normalized coordinates (0.0 to 1.0 range relative to the full image dimensions).

Rules:
- Only detect actual distinct pictures/photos/frames — ignore borders, gaps, text labels, and decorative elements
- Each bounding box should tightly crop the actual picture content
- Return coordinates as: x (left edge), y (top edge), w (width), h (height) — all normalized 0.0-1.0
- Order detections left-to-right, top-to-bottom (reading order)
- If the image appears to be a single picture with no grid/composite structure, return a single region covering the full image

Respond in JSON format only:
{
  "regions": [
    { "x": 0.0, "y": 0.0, "w": 0.5, "h": 0.5, "label": "Brief description" }
  ],
  "gridDetected": true,
  "estimatedLayout": "2x2" 
}`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and detect all individual pictures/frames within it. Return their bounding boxes as normalized coordinates (0.0-1.0). The image dimensions are ${imgWidth}x${imgHeight}px.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM detect error:', errorText);
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from LLM');
    }

    // Parse the JSON response
    let parsed;
    try {
      // Strip markdown code fences if present
      content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      parsed = JSON.parse(content);
    } catch {
      console.error('Failed to parse LLM response:', content);
      throw new Error('Failed to parse detection results');
    }

    // Validate and clamp regions
    const regions = (parsed.regions || []).map((r: { x: number; y: number; w: number; h: number; label?: string }, i: number) => ({
      id: i + 1,
      x: Math.max(0, Math.min(1, r.x)),
      y: Math.max(0, Math.min(1, r.y)),
      w: Math.max(0.01, Math.min(1 - Math.max(0, r.x), r.w)),
      h: Math.max(0.01, Math.min(1 - Math.max(0, r.y), r.h)),
      label: r.label || `Image ${i + 1}`,
      // Also return pixel coordinates for the frontend preview
      px: Math.round(Math.max(0, Math.min(1, r.x)) * imgWidth),
      py: Math.round(Math.max(0, Math.min(1, r.y)) * imgHeight),
      pw: Math.round(Math.max(0.01, Math.min(1 - Math.max(0, r.x), r.w)) * imgWidth),
      ph: Math.round(Math.max(0.01, Math.min(1 - Math.max(0, r.y), r.h)) * imgHeight),
    }));

    trackUsage({ eventType: 'image_grid_detect', apiModel: llm.model, apiType: 'llm', provider: llm.provider });

    return NextResponse.json({
      success: true,
      regions,
      gridDetected: parsed.gridDetected ?? regions.length > 1,
      estimatedLayout: parsed.estimatedLayout || `${regions.length} images`,
      imageWidth: imgWidth,
      imageHeight: imgHeight,
    });
  } catch (error) {
    console.error('Image detection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detect images' },
      { status: 500 }
    );
  }
}
