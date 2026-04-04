import { NextRequest, NextResponse } from 'next/server';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  VerticalAlign,
} from 'docx';

export async function POST(request: NextRequest) {
  try {
    const { dialogueLines, title } = await request.json();
    
    if (!dialogueLines || !Array.isArray(dialogueLines) || dialogueLines.length === 0) {
      return NextResponse.json(
        { error: 'Dialogue lines are required' },
        { status: 400 }
      );
    }

    const safeTitle = (title || 'Screenplay').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    
    // Create table rows
    const tableRows: TableRow[] = [];
    
    // Header row with styling
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 1800, type: WidthType.DXA },
          shading: { fill: '2D3748', type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Character',
                  bold: true,
                  color: 'FFFFFF',
                  size: 24,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 5400, type: WidthType.DXA },
          shading: { fill: '2D3748', type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Dialogue',
                  bold: true,
                  color: 'FFFFFF',
                  size: 24,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 3600, type: WidthType.DXA },
          shading: { fill: '2D3748', type: ShadingType.SOLID },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'Delivery Direction',
                  bold: true,
                  color: 'FFFFFF',
                  size: 24,
                }),
              ],
            }),
          ],
        }),
      ],
    });
    tableRows.push(headerRow);

    // Data rows
    dialogueLines.forEach((line: { character: string; dialogue: string; delivery: string }, index: number) => {
      const isEvenRow = index % 2 === 0;
      const rowShading = isEvenRow ? 'F7FAFC' : 'FFFFFF';
      
      const dataRow = new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            shading: { fill: rowShading, type: ShadingType.SOLID },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.character || '',
                    bold: true,
                    size: 22,
                    color: '1A202C',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 5400, type: WidthType.DXA },
            shading: { fill: rowShading, type: ShadingType.SOLID },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.dialogue || '',
                    size: 22,
                    color: '2D3748',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3600, type: WidthType.DXA },
            shading: { fill: rowShading, type: ShadingType.SOLID },
            verticalAlign: VerticalAlign.TOP,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: line.delivery || '',
                    italics: true,
                    size: 20,
                    color: '718096',
                  }),
                ],
              }),
            ],
          }),
        ],
      });
      tableRows.push(dataRow);
    });

    // Create the table
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E0' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E0' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E0' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E0' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      },
    });

    // Create the document
    const doc = new Document({
      creator: 'Storyshot Creator',
      title: `${safeTitle} - Voice-Over Script`,
      description: 'Voice-over script with dialogue and delivery directions',
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: [
            // Title
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: `${safeTitle}`,
                  bold: true,
                  size: 48,
                  color: '1A202C',
                }),
              ],
            }),
            // Subtitle
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
              children: [
                new TextRun({
                  text: 'Voice-Over Script',
                  size: 28,
                  color: '4A5568',
                }),
              ],
            }),
            // Info line
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 600 },
              children: [
                new TextRun({
                  text: `Generated: ${new Date().toLocaleDateString()}  |  Total Lines: ${dialogueLines.length}`,
                  size: 20,
                  color: '718096',
                }),
              ],
            }),
            // Table
            table,
            // Footer note
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 },
              children: [
                new TextRun({
                  text: 'Generated by Storyshot Creator',
                  size: 18,
                  italics: true,
                  color: 'A0AEC0',
                }),
              ],
            }),
          ],
        },
      ],
    });

    // Generate the DOCX buffer
    const buffer = await Packer.toBuffer(doc);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeTitle}_VoiceOver.docx"`,
      },
    });
  } catch (error) {
    console.error('Voice-over export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export voice-over script' },
      { status: 500 }
    );
  }
}
