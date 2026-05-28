import { NextRequest, NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  convertInchesToTwip, PageBreak, Header, Footer
} from 'docx';

// Audio Drama DOCX — screenplay-like format with Courier font
// NARRATOR blocks get literary italic treatment
// Character cues centered, dialogue indented, SFX/MUSIC/AMBIENCE styled

function isSceneHeading(line: string): boolean {
  return /^SCENE\s+\d+/i.test(line) || /^SCENE\s+[IVXLCDM]+/i.test(line);
}

function isCharacterCue(line: string): boolean {
  // ALL CAPS line that is a character name (2-30 chars, possibly with parenthetical)
  const trimmed = line.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  // Must be all uppercase letters (with spaces, hyphens, periods allowed)
  return /^[A-Z][A-Z\s\-\.\']+$/.test(trimmed) || /^[A-Z][A-Z\s\-\.\']+ \(.*\)$/.test(trimmed);
}

function isSoundCue(line: string): boolean {
  return /^\[(SFX|AMBIENCE|MUSIC|SILENCE|BEAT)/.test(line.trim());
}

function isParenthetical(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')');
}

function isNarratorCue(line: string): boolean {
  return /^NARRATOR\s*$/i.test(line.trim()) || /^NARRATOR\s*\(.*\)$/i.test(line.trim());
}

export async function POST(request: NextRequest) {
  try {
    const { audioDrama, title } = await request.json();

    if (!audioDrama) {
      return NextResponse.json({ error: 'Audio drama content is required' }, { status: 400 });
    }

    const lines = audioDrama.split('\n');
    const paragraphs: Paragraph[] = [];
    const FONT = 'Courier New';
    const FONT_SIZE = 24; // 12pt

    // Title page
    paragraphs.push(new Paragraph({ text: '', spacing: { after: 4000 } }));
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: (title || 'Untitled').toUpperCase(),
            bold: true,
            size: 48,
            font: FONT,
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
            text: 'An Audio Drama',
            italics: true,
            size: 28,
            font: FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'For Voice Performance & Sound Design',
            size: 20,
            font: FONT,
            color: '666666',
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }));

    // Track whether next dialogue block belongs to NARRATOR for italic treatment
    let isNarratorBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      // Empty lines
      if (!trimmed) {
        paragraphs.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        isNarratorBlock = false;
        continue;
      }

      // Scene headings — bold, underlined, caps
      if (isSceneHeading(trimmed)) {
        // Add extra spacing before scene heading
        paragraphs.push(new Paragraph({ text: '', spacing: { after: 400 } }));
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.toUpperCase(),
                bold: true,
                underline: { type: 'single' },
                size: FONT_SIZE,
                font: FONT,
              }),
            ],
            spacing: { after: 240 },
          })
        );
        isNarratorBlock = false;
        continue;
      }

      // Sound cues [SFX: ...], [AMBIENCE: ...], [MUSIC: ...], [BEAT], [SILENCE]
      if (isSoundCue(trimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                bold: true,
                italics: true,
                size: FONT_SIZE,
                font: FONT,
                color: '444444',
              }),
            ],
            indent: { left: convertInchesToTwip(1.5) },
            spacing: { after: 120 },
          })
        );
        continue;
      }

      // NARRATOR character cue — special treatment
      if (isNarratorCue(trimmed)) {
        isNarratorBlock = true;
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.toUpperCase(),
                bold: true,
                size: FONT_SIZE,
                font: FONT,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 60 },
          })
        );
        continue;
      }

      // Character cues (non-narrator) — centered, all caps
      if (isCharacterCue(trimmed)) {
        isNarratorBlock = false;
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.toUpperCase(),
                bold: true,
                size: FONT_SIZE,
                font: FONT,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 60 },
          })
        );
        continue;
      }

      // Parentheticals — centered, smaller
      if (isParenthetical(trimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                italics: true,
                size: FONT_SIZE,
                font: FONT,
              }),
            ],
            alignment: AlignmentType.CENTER,
            indent: { left: convertInchesToTwip(2), right: convertInchesToTwip(2) },
            spacing: { after: 60 },
          })
        );
        continue;
      }

      // NARRATOR dialogue/prose — italic, wider margins for literary feel
      if (isNarratorBlock) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                italics: true,
                size: FONT_SIZE,
                font: FONT,
              }),
            ],
            indent: {
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
            spacing: { after: 120, line: 288 },
          })
        );
        continue;
      }

      // Regular dialogue — indented like screenplay dialogue
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              size: FONT_SIZE,
              font: FONT,
            }),
          ],
          indent: {
            left: convertInchesToTwip(1.5),
            right: convertInchesToTwip(1.5),
          },
          spacing: { after: 60, line: 288 },
        })
      );
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: FONT,
              size: FONT_SIZE,
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
                left: convertInchesToTwip(1.5),
                right: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${(title || 'Untitled').toUpperCase()} — AUDIO DRAMA`,
                      size: 18,
                      font: FONT,
                      italics: true,
                      color: '999999',
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
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
        'Content-Disposition': `attachment; filename="${(title || 'audio-drama').replace(/[^a-zA-Z0-9\s-]/g, '')}_Audio_Drama.docx"`,
      },
    });
  } catch (error) {
    console.error('Audio drama download error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate audio drama document' },
      { status: 500 }
    );
  }
}
