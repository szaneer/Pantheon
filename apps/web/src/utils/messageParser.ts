export interface ParsedMessageContent {
  thinking: string | null;
  mainContent: string;
}

export function parseMessageContent(content: string): ParsedMessageContent {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  const matches = content.match(thinkRegex);
  
  if (!matches) {
    return {
      thinking: null,
      mainContent: content
    };
  }
  
  // Extract thinking content (remove tags)
  const thinking = matches
    .map(match => match.replace(/<\/?think>/g, '').trim())
    .join('\n\n');
  
  // Remove thinking tags from main content
  const mainContent = content.replace(thinkRegex, '').trim();
  
  return {
    thinking: thinking || null,
    mainContent
  };
}