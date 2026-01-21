import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { dialogueLines, title, format = 'csv' } = await request.json();
    
    if (!dialogueLines || !Array.isArray(dialogueLines) || dialogueLines.length === 0) {
      return NextResponse.json(
        { error: 'Dialogue lines are required' },
        { status: 400 }
      );
    }

    const safeTitle = (title || 'Screenplay').replace(/[^a-zA-Z0-9\s-]/g, '').trim();
    
    if (format === 'csv') {
      // Create CSV content with proper escaping
      const escapeCSV = (field: string) => {
        if (field.includes('"') || field.includes(',') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      const headers = ['Character', 'Dialogue', 'Delivery Direction'];
      const rows = dialogueLines.map((line: { character: string; dialogue: string; delivery: string }) => [
        escapeCSV(line.character || ''),
        escapeCSV(line.dialogue || ''),
        escapeCSV(line.delivery || '')
      ].join(','));
      
      const csvContent = [headers.join(','), ...rows].join('\n');
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeTitle}_VoiceOver.csv"`,
        },
      });
    } else {
      // Create formatted text table
      const maxCharLen = Math.max(15, ...dialogueLines.map((l: { character: string }) => l.character.length));
      const maxDialogueLen = Math.min(60, Math.max(20, ...dialogueLines.map((l: { dialogue: string }) => l.dialogue.length)));
      const maxDeliveryLen = Math.min(50, Math.max(20, ...dialogueLines.map((l: { delivery: string }) => l.delivery.length)));

      const divider = '+' + '-'.repeat(maxCharLen + 2) + '+' + '-'.repeat(maxDialogueLen + 2) + '+' + '-'.repeat(maxDeliveryLen + 2) + '+';
      
      const headerRow = '| ' + 'Character'.padEnd(maxCharLen) + ' | ' + 'Dialogue'.padEnd(maxDialogueLen) + ' | ' + 'Delivery Direction'.padEnd(maxDeliveryLen) + ' |';
      
      const wrapText = (text: string, maxLen: number): string[] => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          if (currentLine.length + word.length + 1 <= maxLen) {
            currentLine += (currentLine ? ' ' : '') + word;
          } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word.length > maxLen ? word.substring(0, maxLen) : word;
          }
        }
        if (currentLine) lines.push(currentLine);
        return lines.length ? lines : [''];
      };

      let textContent = `VOICE-OVER SCRIPT: ${safeTitle}\n`;
      textContent += `Generated: ${new Date().toLocaleDateString()}\n`;
      textContent += `Total Lines: ${dialogueLines.length}\n\n`;
      textContent += divider + '\n';
      textContent += headerRow + '\n';
      textContent += divider + '\n';
      
      for (const line of dialogueLines) {
        const charLines = wrapText(line.character || '', maxCharLen);
        const dialogueLineArr = wrapText(line.dialogue || '', maxDialogueLen);
        const deliveryLines = wrapText(line.delivery || '', maxDeliveryLen);
        
        const maxRows = Math.max(charLines.length, dialogueLineArr.length, deliveryLines.length);
        
        for (let i = 0; i < maxRows; i++) {
          const charPart = (charLines[i] || '').padEnd(maxCharLen);
          const dialoguePart = (dialogueLineArr[i] || '').padEnd(maxDialogueLen);
          const deliveryPart = (deliveryLines[i] || '').padEnd(maxDeliveryLen);
          textContent += `| ${charPart} | ${dialoguePart} | ${deliveryPart} |\n`;
        }
        textContent += divider + '\n';
      }
      
      return new NextResponse(textContent, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${safeTitle}_VoiceOver.txt"`,
        },
      });
    }
  } catch (error) {
    console.error('Voice-over export error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to export voice-over script' },
      { status: 500 }
    );
  }
}
