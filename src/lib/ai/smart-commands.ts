export interface CommandContext {
  userText: string;
}

export function detectAndProcessCommand(text: string): { 
  hasCommand: boolean; 
  instruction?: string; 
  cleanText?: string;
} {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return { hasCommand: false };
  }

  const parts = trimmed.split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  switch (command) {
    case "/sku":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /sku. 
        Action: User wants specific details for the product: "${args}". 
        Requirement: Use the getProductDetails tool first. If data like COGS is missing from the database, you must mention it as "missing from records" and invite the user to provide it manually.
        Output Format: Product Name: ₹Price (-₹COGS) = Margin%, Stock Status.`,
        cleanText: args ? `Tell me about SKU ${args}` : "List my top SKUs"
      };

    case "/profit":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /profit.
        Action: Calculate net profit for "${args || 'the last month'}". 
        Requirement: Account for revenue, ad spend, and refunds. If marketing data is not fully integrated, use available revenue and ask for an estimated ad spend to calculate 'True Net'.
        Output Format: [Period]: ₹Revenue → ₹Net (Margin%) vs Target.`,
        cleanText: `Show my profit for ${args || 'last month'}`
      };

    case "/ltv":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /ltv.
        Action: Get lifecycle metrics for "${args}".
        Requirement: Provide lifetime value, order frequency, and an estimated churn risk based on the last order date.
        Output Format: [Email]: X orders, ₹LTV, % repeat probability / churn risk.`,
        cleanText: `What is the LTV for ${args}?`
      };

    case "/roas":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /roas.
        Action: Calculate attributed ROAS for campaign: "${args}".
        Requirement: Connect spend from marketing tools with attributed revenue from Shopify/ecommerce orders.
        Output Format: [Campaign]: X.Xx ROAS (₹Spend → ₹Attributed Revenue).`,
        cleanText: `What is the ROAS for ${args}?`
      };

    case "/gross":
    case "/net":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: ${command}. 
        Action: The user wants to toggle figures to ${command === '/gross' ? 'Gross (pre-tax/pre-expense)' : 'Net (after costs)'}.
        Requirement: Ensure all following figures in this response are labeled as ${command.replace('/', '').toUpperCase()}.`,
        cleanText: `Show figures as ${command.replace('/', '')}`
      };

    case "/warn":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /warn.
        Action: Set an alert rule: "${args}".
        Requirement: Acknowledge the rule and save it to the user's memories so it can be used for future proactive notifications during sync jobs.`,
        cleanText: `Set a warning alert for: ${args}`
      };

    case "/save":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /save.
        Action: Save the current query or data view as a preset named: "${args}".
        Requirement: Store this as a persistent preference in the user's memories.`,
        cleanText: `Save this search as ${args}`
      };

    case "/signals":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /signals.
        Action: Provide only verified professional trader signals.
        Requirement: Use getVerifiedTraderSignals. Do not generate predictions or independent trades.
        Output must include: trade action, asset, traders involved, confidence based only on trader quality + agreement, and short factual source reason.
        Also render the strongest consensus trade as a fenced code block using language trade-chart with JSON containing title, subtitle, symbol, timeframe, action, confidence, entry, stopLoss, and takeProfit.
        If there are no verified entries, respond exactly: "No confirmed professional trader signals at this time."
        Include newly opened trades, newly closed trades, and highlight strong consensus trades.`,
        cleanText: args
          ? `Show verified professional trader signals for ${args}`
          : "Show verified professional trader signals"
      };

    case "/browse":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /browse.
        Action: Open a live browser session for the requested site or destination.
        Requirement: Use the browser tools first. If the destination is missing, ask exactly one short follow-up question asking which website to open.`,
        cleanText: args
          ? `Open ${args} in the browser and keep the live browser session available here.`
          : "Open a website in the browser."
      };

    case "/research":
      return {
        hasCommand: true,
        instruction: `USER COMMAND: /research.
        Action: Research the requested topic on the public web.
        Requirement: Use web research tools, cite the most relevant sources, and if the topic is missing ask exactly one short follow-up question.`,
        cleanText: args
          ? `Research ${args} on the web and cite the most relevant sources.`
          : "Research a topic on the web and cite the most relevant sources."
      };

    default:
      return { hasCommand: false };
  }
}
