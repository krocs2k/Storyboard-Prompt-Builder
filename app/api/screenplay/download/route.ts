import { NextRequest, NextResponse } from 'next/server';
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  convertInchesToTwip, Header, Footer, PageBreak
} from 'docx';

/**
 * Industry-standard screenplay formatting constants.
 * Based on Final Draft / Courier 12pt conventions:
 * - Page margins: 1.5" left, 1" right, 1" top, 1" bottom
 * - Font: Courier New 12pt throughout
 * - Scene headings: ALL CAPS, left-aligned, bold
 * - Action: Left-aligned, full width
 * - Character names: Centered (3.7" from left edge)
 * - Parentheticals: Centered, italics (3.1" from left)
 * - Dialogue: Centered block (2.5" from left, 2.5" from right)
 * - Transitions: Right-aligned, ALL CAPS
 */
const COURIER_12 = 24; // docx size in half-points (12pt = 24)
const FONT = 'Courier New';

function isSceneHeading(line: string): boolean {
  return /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s/i.test(line);
}

function isTransition(line: string): boolean {
  return /^(FADE IN:|FADE OUT\.|FADE TO BLACK\.|CUT TO:|SMASH CUT TO:|DISSOLVE TO:|MATCH CUT TO:|JUMP CUT TO:|WIPE TO:|TIME CUT:|IRIS IN:|IRIS OUT:)\s*$/i.test(line)
    || /^.*TO:$/i.test(line.trim());
}

function isCharacterCue(line: string, nextLine?: string): boolean {
  // Character cue: ALL CAPS line, typically < 40 chars, followed by dialogue or parenthetical
  if (line.length > 40) return false;
  if (!/^[A-Z][A-Z\s.'\-()]+$/.test(line)) return false;
  // Check for common non-character ALL CAPS patterns
  if (isSceneHeading(line)) return false;
  if (isTransition(line)) return false;
  if (/^(CONTINUED|END OF|THE END|TITLE CARD|SUPER|INTERCUT|SERIES OF|MONTAGE|FLASHBACK|BACK TO|LATER|MORNING|NIGHT|DAY|CONTINUOUS)/.test(line)) return false;
  return true;
}

function isParenthetical(line: string): boolean {
  return /^\(.*\)$/.test(line.trim());
}

export async function POST(request: NextRequest) {
  try {
    const { screenplay, title, format } = await request.json();

    if (!screenplay) {
      return NextResponse.json({ error: 'Screenplay content is required' }, { status: 400 });
    }

    if (format === 'txt') {
      return new NextResponse(screenplay, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="${title || 'screenplay'}.txt"`,
        },
      });
    }

    // Build industry-standard screenplay DOCX
    const lines = screenplay.split('\n');
    const paragraphs: Paragraph[] = [];

    // Title page
    paragraphs.push(new Paragraph({ text: '', spacing: { after: 6000 } }));
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: (title || 'SCREENPLAY').toUpperCase(),
            bold: true,
            size: COURIER_12,
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
            text: 'Written by',
            size: COURIER_12,
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
            text: 'Storyshot Creator',
            size: COURIER_12,
            font: FONT,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }));

    // Process screenplay lines
    let prevWasCharacterCue = false;
    let prevWasParenthetical = false;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      const nextTrimmed = (i + 1 < lines.length) ? lines[i + 1]?.trim() || '' : '';

      if (!trimmed) {
        paragraphs.push(new Paragraph({
          spacing: { after: 0, before: 0, line: 240 },
          children: [new TextRun({ text: '', size: COURIER_12, font: FONT })],
        }));
        prevWasCharacterCue = false;
        prevWasParenthetical = false;
        continue;
      }

      // Scene headings
      if (isSceneHeading(trimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.toUpperCase(),
                bold: true,
                underline: { type: 'single' },
                size: COURIER_12,
                font: FONT,
              }),
            ],
            spacing: { before: 480, after: 240 },
          })
        );
        prevWasCharacterCue = false;
        prevWasParenthetical = false;
        continue;
      }

      // Transitions
      if (isTransition(trimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed.toUpperCase(),
                size: COURIER_12,
                font: FONT,
              }),
            ],
            alignment: AlignmentType.RIGHT,
            spacing: { before: 240, after: 240 },
          })
        );
        prevWasCharacterCue = false;
        prevWasParenthetical = false;
        continue;
      }

      // Parenthetical
      if (isParenthetical(trimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                italics: true,
                size: COURIER_12,
                font: FONT,
              }),
            ],
            indent: {
              left: convertInchesToTwip(2.1),
              right: convertInchesToTwip(1.6),
            },
            spacing: { after: 0 },
          })
        );
        prevWasCharacterCue = false;
        prevWasParenthetical = true;
        continue;
      }

      // Character cue (ALL CAPS name before dialogue)
      if (isCharacterCue(trimmed, nextTrimmed)) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                bold: true,
                size: COURIER_12,
                font: FONT,
              }),
            ],
            indent: { left: convertInchesToTwip(2.2) },
            spacing: { before: 240, after: 0 },
          })
        );
        prevWasCharacterCue = true;
        prevWasParenthetical = false;
        continue;
      }

      // Dialogue (line right after character cue or parenthetical)
      if (prevWasCharacterCue || prevWasParenthetical) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                size: COURIER_12,
                font: FONT,
              }),
            ],
            indent: {
              left: convertInchesToTwip(1.5),
              right: convertInchesToTwip(1.0),
            },
            spacing: { after: 0, line: 240 },
          })
        );
        // Stay in dialogue mode if next line looks like continuation
        const nextIsEmpty = !nextTrimmed;
        const nextIsParenthetical = isParenthetical(nextTrimmed);
        if (nextIsEmpty) {
          prevWasCharacterCue = false;
          prevWasParenthetical = false;
        } else if (nextIsParenthetical) {
          prevWasCharacterCue = false;
          prevWasParenthetical = false; // parenthetical handler will set it
        } else {
          // Continue dialogue on next line
          prevWasCharacterCue = true;
        }
        continue;
      }

      // Action/description (default)
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed,
              size: COURIER_12,
              font: FONT,
            }),
          ],
          spacing: { after: 240, line: 240 },
        })
      );
      prevWasCharacterCue = false;
      prevWasParenthetical = false;
    }

    // Create the document with proper screenplay margins
    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: FONT,
              size: COURIER_12,
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
                      text: (title || 'Screenplay').toUpperCase(),
                      size: 18,
                      font: FONT,
                    }),
                  ],
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            }),
          },
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // Always return as DOCX
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${(title || 'screenplay').replace(/[^a-zA-Z0-9\s-]/g, '')}.docx"`,
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
