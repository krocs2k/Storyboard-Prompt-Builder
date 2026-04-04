import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export async function POST(request: NextRequest) {
  try {
    const { screenplay, title, format } = await request.json();
    
    if (!screenplay) {
      return NextResponse.json(
        { error: 'Screenplay content is required' },
        { status: 400 }
      );
    }

    if (format === 'txt') {
      // Plain text download
      return new NextResponse(screenplay, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${title || 'screenplay'}.txt"`,
        },
      });
    }

    // For DOC and DOCX, generate a Word document
    const lines = screenplay.split('\n');
    const paragraphs: Paragraph[] = [];

    // Add title
    paragraphs.push(
      new Paragraph({
        text: title || 'Screenplay',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );

    // Process screenplay content
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        // Empty line
        paragraphs.push(new Paragraph({ text: '' }));
        continue;
      }

      // Scene headings (INT./EXT.)
      if (trimmedLine.match(/^(INT\.|EXT\.|INT\/EXT\.)/) || trimmedLine.match(/^---.*---$/)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                bold: true,
                allCaps: true,
              }),
            ],
            spacing: { before: 400, after: 200 },
          })
        );
      }
      // Character names (ALL CAPS at start of dialogue)
      else if (trimmedLine.match(/^[A-Z][A-Z\s]+$/) && trimmedLine.length < 30) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                bold: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
          })
        );
      }
      // Parentheticals
      else if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
          })
        );
      }
      // Action/description lines
      else if (trimmedLine.match(/^\[.*\]$/)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                italics: true,
              }),
            ],
            spacing: { before: 100, after: 100 },
          })
        );
      }
      // Regular text (dialogue or action)
      else {
        paragraphs.push(
          new Paragraph({
            text: trimmedLine,
            spacing: { after: 100 },
          })
        );
      }
    }

    // Create the document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    // Generate the buffer
    const buffer = await Packer.toBuffer(doc);

    // Return as DOCX (works for both .doc and .docx as modern Word opens both)
    const contentType = format === 'doc' 
      ? 'application/msword'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${title || 'screenplay'}.${format}"`,
      },
    });
  } catch (error) {
    console.error('Screenplay download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate download' },
      { status: 500 }
    );
  }
}
