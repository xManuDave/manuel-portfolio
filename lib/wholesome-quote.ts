export type Quote = { quote: string; author: string };

export const QUOTE_FALLBACKS: Quote[] = [
  { quote: "There is no rush. Good work can grow at a human pace.", author: "Room note" },
  { quote: "Small steps still move the whole story forward.", author: "Room note" },
  { quote: "Make room for the quiet parts of the day.", author: "Room note" },
];

const warmWords = /\b(kind|kindness|love|smile|happy|happiness|joy|friend|friends|lift|light|gentle|peace|hope|dream|dreams|courage|beautiful|beauty|giving|value|heart|wonder|grow|grows|growth)\b/i;
const harshWords = /kill|war|hate|death|enemy|revenge|weapon/i;

export async function fetchWholesomeQuote(signal?: AbortSignal): Promise<Quote> {
  try {
    const response = await fetch("https://dummyjson.com/quotes/random/10", { cache: "no-store", signal });
    if (!response.ok) throw new Error("Quote API failed");
    const data = await response.json() as Array<{ quote?: string; author?: string }>;
    const wholesome = data.filter((item): item is Quote => !!item.quote && !!item.author && item.quote.length <= 160 && warmWords.test(item.quote) && !harshWords.test(item.quote));
    if (!wholesome.length) throw new Error("No wholesome quote returned");
    return wholesome[Math.floor(Math.random() * wholesome.length)];
  } catch (error) {
    if (signal?.aborted) throw error;
    return QUOTE_FALLBACKS[Math.floor(Math.random() * QUOTE_FALLBACKS.length)];
  }
}
