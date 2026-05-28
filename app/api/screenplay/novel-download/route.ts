import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, AlignmentType, TabStopType, TabStopPosition, convertInchesToTwip, PageBreak, Header, Footer } from 'docx';

export async function POST(request: NextRequest) {
  try {
    const { novel, title } = await request.json();

    if (!novel) {
      return NextResponse.json({ error: 'Novel content is required' }, { status: 400 });
    }

    const lines = novel.split('\n');
    const paragraphs: Paragraph[] = [];

    // Title page
    paragraphs.push(new Paragraph({ text: '', spacing: { after: 6000 } }));
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: (title || 'Untitled Novel').toUpperCase(),
            bold: true,
            size: 48,
            font: 'Garamond',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      })
    );
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'A Novel',
            italics: true,
            size: 28,
            font: 'Garamond',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }));

    // Process novel content
    let inChapter = false;
    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        paragraphs.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        continue;
      }

      // Chapter headings (e.g., "Chapter 1: ...", "CHAPTER ONE", etc.)
      const chapterMatch = trimmed.match(/^(Chapter\s+\w+[:\s\-—]*.*|CHAPTER\s+\w+[:\s\-—]*.*)$/i);
      if (chapterMatch) {
        // Add page break before each chapter (except the first)
        if (inChapter) {
          paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
        }
        inChapter = true;

        // Add some spacing at top of chapter
        paragraphs.push(new Paragraph({ text: '', spacing: { after: 2400 } }));

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.toUpperCase(),
                bold: true,
                size: 28,
                font: 'Garamond',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 800 },
          })
        );
        continue;
      }

      // Section breaks (*** or --- or ===)
      if (/^[\*\-=]{3,}$/.test(trimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: '* * *',
                size: 24,
                font: 'Garamond',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 400 },
          })
        );
        continue;
      }

      // Dialogue (lines starting with quotes)
      if (trimmed.startsWith('"') || trimmed.startsWith('\u201C')) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                size: 24,
                font: 'Garamond',
              }),
            ],
            indent: { firstLine: convertInchesToTwip(0.5) },
            spacing: { after: 120, line: 360 },
          })
        );
        continue;
      }

      // Regular prose paragraphs
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              size: 24,
              font: 'Garamond',
            }),
          ],
          indent: { firstLine: convertInchesToTwip(0.5) },
          spacing: { after: 120, line: 360 },
        })
      );
    }

    // Create the document
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: 'Garamond',
              size: 24,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.25),
                right: convertInchesToTwip(1.25),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: (title || 'Untitled Novel').toUpperCase(),
                      size: 18,
                      font: 'Garamond',
                      italics: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [],
                }),
              ],
            }),
          },
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${(title || 'novel').replace(/[^a-zA-Z0-9\s-]/g, '')}_Novel.docx"`,
      },
    });
  } catch (error) {
    console.error('Novel download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate novel document' },
      { status: 500 }
    );
  }
}
