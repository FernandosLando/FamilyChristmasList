import { NextRequest, NextResponse } from 'next/server';
import { load } from 'cheerio';

export const dynamic = 'force-dynamic';

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const DIRECT_TIMEOUT = 4500;
const RENDER_TIMEOUT = 9000;

// Normalize a price string (like "$29.99" or "29,99") to a number.
function cleanPrice(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^0-9.,]/g, '');
  if (!cleaned) return null;

  // Handle both "1,299.99" and "1299,99" styles.
  const normalized =
    cleaned.includes(',') && !cleaned.includes('.')
      ? cleaned.replace(',', '.')
      : cleaned.replace(/,/g, '');

  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

async function fetchWithTimeout(
  targetUrl: string,
  options: RequestInit = {},
  timeoutMs: number
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(targetUrl, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function parseProduct(html: string, baseUrl: string) {
  const $ = load(html);
  const hostname = (() => {
    try {
      return new URL(baseUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  const resolveUrl = (input: string | null | undefined): string | null => {
    if (!input) return null;
    try {
      return new URL(input, baseUrl).toString();
    } catch {
      return null;
    }
  };

  // ---------- TITLE ----------
  const titleMeta =
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="og:title"]').attr('content') ||
    $('meta[name="title"]').attr('content');
  let title: string | null = titleMeta || $('title').first().text() || null;
  if (title) title = title.replace(/\s+/g, ' ').trim();

  // ---------- DESCRIPTION ----------
  const descMeta =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="og:description"]').attr('content');
  let description: string | null = descMeta || null;
  if (description) description = description.replace(/\s+/g, ' ').trim();

  // ---------- IMAGE ----------
  let imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[property="og:image:url"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    null;

  // Amazon places the real image in data-a-dynamic-image / data-old-hires.
  if (!imageUrl && hostname.includes('amazon.')) {
    const amazonImageData =
      $('#imgTagWrapperId img').attr('data-a-dynamic-image') ||
      $('#landingImage').attr('data-a-dynamic-image');
    if (amazonImageData) {
      try {
        const parsed = JSON.parse(amazonImageData);
        const firstKey = Object.keys(parsed)[0];
        if (firstKey) imageUrl = firstKey;
      } catch {
        //
      }
    }

    if (!imageUrl) {
      const amazonHiRes =
        $('#imgTagWrapperId img').attr('data-old-hires') ||
        $('#landingImage').attr('data-old-hires');
      if (amazonHiRes) imageUrl = amazonHiRes;
    }

    if (!imageUrl) {
      const hiResMatch = html.match(/"hiRes"\s*:\s*"([^"]+)"/);
      if (hiResMatch?.[1]) imageUrl = hiResMatch[1];
    }

    if (!imageUrl) {
      const largeMatch = html.match(/"large"\s*:\s*"([^"]+)"/);
      if (largeMatch?.[1]) imageUrl = largeMatch[1];
    }
  }

  if (!imageUrl) {
    const candidateImg = $('img[src]')
      .filter((_, el) => {
        const src = $(el).attr('src');
        if (!src || src.startsWith('data:')) return false;
        const width = Number($(el).attr('width')) || 0;
        const height = Number($(el).attr('height')) || 0;
        return width >= 120 && height >= 120;
      })
      .first()
      .attr('src');
    imageUrl = candidateImg ?? null;
  }

  imageUrl = resolveUrl(imageUrl);

  // ---------- PRICE ----------
  let price: number | null = null;

  // Common meta price tags
  if (price == null) {
    const metaPrice =
      $('meta[property="product:price:amount"]').attr('content') ||
      $('meta[property="og:price:amount"]').attr('content') ||
      $('meta[name="twitter:data1"]').attr('content');
    price = cleanPrice(metaPrice);
  }

  // Amazon-specific price blocks and embedded JSON (covers most store/locale variations).
  if (price == null && hostname.includes('amazon.')) {
    const amazonPriceText =
      $('#corePriceDisplay_desktop_feature_div .a-offscreen').first().text() ||
      $('#corePrice_feature_div .a-offscreen').first().text() ||
      $('#priceblock_ourprice').text() ||
      $('#priceblock_dealprice').text() ||
      $('#priceblock_saleprice').text() ||
      $('.a-price .a-offscreen').first().text();
    price = cleanPrice(amazonPriceText);

    if (price == null) {
      const priceMatches = [
        /"priceToPay":\{"rawPrice":"([^"]+)"/,
        /"apexPriceToPay":\{"amount":"([^"]+)"/,
        /"rawPrice":"([^"]+)"/,
        /"displayPrice"\s*:\s*"([^"]+)"/,
        /"priceAmount"\s*:\s*"([^"]+)"/,
        /"amount"\s*:\s*"([^"]+)"\s*,\s*"currencySymbol"/,
        /"price"\s*:\s*\{\s*"value"\s*:\s*([0-9]+\.[0-9]+)/,
      ];
      for (const re of priceMatches) {
        const m = html.match(re);
        if (m?.[1]) {
          price = cleanPrice(m[1]);
          if (price != null) break;
        }
      }
    }
  }

  // Best Buy: try JSON fragments (salePrice/regularPrice) and price blocks.
  if (price == null && hostname.includes('bestbuy.')) {
    const candidates: number[] = [];
    const pushCandidate = (val: string | null | undefined) => {
      const p = cleanPrice(val);
      if (p != null) candidates.push(p);
    };

    // Priority selectors (try these first and stop if we get a sane price).
    const bbPriorityFields = [
      $('[data-testid="customer-price"]').text(),
      $('.priceView-hero-price').text(),
      $('.priceView-hero-price span[aria-hidden="true"]').text(),
      $('.priceView-customer-price').text(),
      $('.priceView-customer-price .sr-only').text(),
      $('[itemprop="price"]').attr('content'),
      $('.text-style-body-md-400').text(),
      $('span.font-sans.text-default.text-style-body-md-400').text(),
    ];
    for (const val of bbPriorityFields) {
      const p = cleanPrice(val);
      if (p != null && p >= 10) {
        price = p;
        break;
      }
    }

    // If no priority hit, gather all hints and pick the most reasonable.
    if (price == null) {
      const bbRegexes = [
        /"salePrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi,
        /"regularPrice"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi,
        /"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi,
        /"customerPrice":\s*\{\s*"currentPrice":\s*\{\s*"value":\s*([0-9]+(?:\.[0-9]+)?)/gi,
        /"customerPrice":\s*\{\s*"currentPrice":\s*\{\s*"price":\s*([0-9]+(?:\.[0-9]+)?)/gi,
        /"formattedSalePrice"\s*:\s*"\$?([0-9]+(?:\.[0-9]{2})?)"/gi,
        /"formattedPriceValue"\s*:\s*"\$?([0-9]+(?:\.[0-9]{2})?)"/gi,
        /"priceWithPlan":\s*\{\s*"price":\s*([0-9]+(?:\.[0-9]+)?)/gi,
        /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi,
      ];
      for (const re of bbRegexes) {
        let m;
        while ((m = re.exec(html)) !== null) {
          pushCandidate(m[1]);
        }
      }

      // $xx.xx patterns
      const dollarRegex = /\$\s*([0-9]{1,4}(?:,[0-9]{3})?(?:\.[0-9]{2})?)/g;
      let mDollar;
      while ((mDollar = dollarRegex.exec(html)) !== null) {
        pushCandidate(mDollar[1]);
      }

      const filtered = candidates.filter((c) => c >= 10);
      if (filtered.length > 0) {
        // Choose the lowest "sane" price to avoid competitor/plan highs.
        price = Math.min(...filtered);
      } else if (candidates.length > 0) {
        price = Math.min(...candidates);
      }
    }
  }

  // Normalize final price to two decimal places if present.
  if (price != null) {
    price = Math.round(price * 100) / 100;
  }

  const extractPriceFromObject = (obj: any): number | null => {
    if (!obj || typeof obj !== 'object') return null;

    const offers = Array.isArray(obj.offers) ? obj.offers.find(Boolean) : obj.offers;

    const priceCandidates = [
      offers?.price,
      offers?.lowPrice,
      offers?.highPrice,
      offers?.priceSpecification?.price,
      obj.price,
      obj.priceSpecification?.price,
    ];

    for (const candidate of priceCandidates) {
      const p = cleanPrice(
        typeof candidate === 'string' || typeof candidate === 'number'
          ? String(candidate)
          : null
      );
      if (p != null) return p;
    }

    // Some sites nest data under @graph, itemOffered, or arrays.
    if (Array.isArray(obj)) {
      for (const entry of obj) {
        const nested = extractPriceFromObject(entry);
        if (nested != null) return nested;
      }
    }

    if (obj['@graph'] && Array.isArray(obj['@graph'])) {
      for (const g of obj['@graph']) {
        const nested = extractPriceFromObject(g);
        if (nested != null) return nested;
      }
    }

    if (obj.itemListElement && Array.isArray(obj.itemListElement)) {
      for (const item of obj.itemListElement) {
        const nested = extractPriceFromObject(item);
        if (nested != null) return nested;
      }
    }

    if (obj.itemOffered) {
      const nested = extractPriceFromObject(obj.itemOffered);
      if (nested != null) return nested;
    }

    return null;
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    if (price != null) return;
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    // Some sites wrap JSON-LD in HTML comments.
    const cleanedText = raw.replace(/^<!--/, '').replace(/-->$/, '');
    try {
      const parsed = JSON.parse(cleanedText);
      const extracted = extractPriceFromObject(parsed);
      if (extracted != null) {
        price = extracted;
      }
    } catch (err) {
      console.warn('JSON-LD parse failed, skipping block', err);
    }
  });

  if (price == null) {
    if (hostname.includes('amazon.')) {
      const amazonPrice =
        $('#priceblock_ourprice').text() ||
        $('#priceblock_dealprice').text() ||
        $('#priceblock_saleprice').text() ||
        $('.a-price .a-offscreen').first().text();
      price = cleanPrice(amazonPrice);
    }
  }

  if (price == null) {
    // Microdata fallback (itemprop="price")
    const microPrice = $('[itemprop="price"]').first();
    const candidate =
      microPrice.attr('content') ||
      microPrice.attr('value') ||
      microPrice.text();
    price = cleanPrice(candidate);
  }

  if (price == null) {
    // Fallback regex for $XX.XX patterns
    const priceMatch = html.match(/\$[0-9]{1,5}(?:,[0-9]{3})*(?:\.[0-9]{2})?/);
    if (priceMatch) {
      price = cleanPrice(priceMatch[0]);
    }
  }

  return {
    title: title || null,
    description: description || null,
    imageUrl: imageUrl || null,
    price,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing url' }, { status: 400 });
    }

    // Only allow http/https and reject malformed URLs early.
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    const commonHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    };

    let html: string | null = null;
    let sourceUsed: 'direct' | 'scraper' | null = null;

    // Try direct fetch first for speed and to let redirects (like a.co) resolve early.
    try {
      const directResp = await fetchWithTimeout(
        url,
        { headers: commonHeaders, redirect: 'follow', cache: 'no-store' },
        DIRECT_TIMEOUT
      );
      if (directResp.ok) {
        const text = await directResp.text();
        if (text && text.length > 500) {
          html = text;
          sourceUsed = 'direct';
        }
      }
    } catch (err) {
      console.warn('Direct fetch failed, will try render:', err);
    }

    // Rendered fetch via ScraperAPI as fallback for JS-heavy pages.
    if ((!html || html.length < 500) && SCRAPER_API_KEY) {
      const scraperUrl = `https://api.scraperapi.com/?api_key=${encodeURIComponent(
        SCRAPER_API_KEY
      )}&render=true&url=${encodeURIComponent(url)}`;

      try {
        const scraperResp = await fetchWithTimeout(
          scraperUrl,
          { headers: commonHeaders, cache: 'no-store' },
          RENDER_TIMEOUT
        );
        if (scraperResp.ok) {
          const text = await scraperResp.text();
          if (text && text.length > 500) {
            html = text;
            sourceUsed = 'scraper';
          }
        } else {
          console.error('ScraperAPI error status:', scraperResp.status);
        }
      } catch (err) {
        console.error('ScraperAPI request failed:', err);
      }
    }

    if (!html) {
      return NextResponse.json(
        { error: 'Could not fetch product details automatically.' },
        { status: 502 }
      );
    }

    const parsed = parseProduct(html, url);
    return NextResponse.json({ ...parsed, source: sourceUsed });
  } catch (err) {
    console.error('Unexpected scrape error:', err);
    return NextResponse.json(
      { error: 'Could not fetch product details automatically.' },
      { status: 500 }
    );
  }
}
